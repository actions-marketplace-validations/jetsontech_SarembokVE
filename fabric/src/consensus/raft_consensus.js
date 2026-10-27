/**
 * SarembokVE Distributed Consensus Engine - Raft Protocol Implementation
 * Pillar 1: Move from Local Monolith to Distributed Micro-Kernel Architecture
 * 
 * Provides:
 * - Raft Leader Election with randomized election timeouts
 * - Log replication with quorum consensus: Math.floor(N / 2) + 1
 * - Atomic state machine commitment
 * - Dynamic cluster membership management
 */

import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

export const RaftRole = {
  LEADER: 'LEADER',
  CANDIDATE: 'CANDIDATE',
  FOLLOWER: 'FOLLOWER'
};

export class RaftNode extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.nodeId - Unique identifier for this cluster node
   * @param {string[]} [options.peers=[]] - Array of peer node IDs
   * @param {number} [options.heartbeatInterval=50] - Leader heartbeat interval in ms
   * @param {number} [options.minElectionTimeout=150] - Min election timeout in ms
   * @param {number} [options.maxElectionTimeout=300] - Max election timeout in ms
   * @param {Function} [options.transportSend] - Transport dispatch callback (targetNodeId, message)
   */
  constructor(options = {}) {
    super();
    this.nodeId = options.nodeId || `node-${crypto.randomUUID().slice(0, 8)}`;
    this.peers = new Set(options.peers || []);
    this.heartbeatInterval = options.heartbeatInterval || 50;
    this.minElectionTimeout = options.minElectionTimeout || 150;
    this.maxElectionTimeout = options.maxElectionTimeout || 300;
    this.transportSend = options.transportSend || null;

    // Persistent state on all servers
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = []; // Array of { term, index, command, id }

    // Volatile state on all servers
    this.commitIndex = 0;
    this.lastApplied = 0;
    this.role = RaftRole.FOLLOWER;
    this.leaderId = null;

    // Volatile state on leaders
    this.nextIndex = new Map();
    this.matchIndex = new Map();

    // Timers
    this.electionTimer = null;
    this.heartbeatTimer = null;

    // State machine callback
    this.stateMachineApplier = options.applyCommand || ((cmd) => cmd);
  }

  /**
   * Start the Raft node
   */
  start() {
    this.role = RaftRole.FOLLOWER;
    this.resetElectionTimeout();
    this.emit('started', { nodeId: this.nodeId, role: this.role, term: this.currentTerm });
  }

  /**
   * Stop all timers and shutdown node
   */
  stop() {
    this.clearElectionTimer();
    this.clearHeartbeatTimer();
    this.role = RaftRole.FOLLOWER;
    this.emit('stopped', { nodeId: this.nodeId });
  }

  /**
   * Add a peer node to the cluster
   * @param {string} peerId 
   */
  addPeer(peerId) {
    if (peerId !== this.nodeId) {
      this.peers.add(peerId);
      if (this.role === RaftRole.LEADER) {
        this.nextIndex.set(peerId, this.log.length + 1);
        this.matchIndex.set(peerId, 0);
      }
    }
  }

  /**
   * Remove a peer node from the cluster
   * @param {string} peerId 
   */
  removePeer(peerId) {
    this.peers.delete(peerId);
    this.nextIndex.delete(peerId);
    this.matchIndex.delete(peerId);
  }

  /**
   * Quorum size calculation: majority of total cluster nodes (peers + self)
   */
  getQuorumSize() {
    const totalNodes = this.peers.size + 1;
    return Math.floor(totalNodes / 2) + 1;
  }

  /**
   * Propose a command to the distributed cluster
   * Only callable on the current Leader.
   * @param {any} command 
   * @returns {Promise<Object>} Resolves when command is committed by quorum
   */
  async propose(command) {
    if (this.role !== RaftRole.LEADER) {
      throw new Error(`Cannot propose to non-leader node '${this.nodeId}'. Current leader: ${this.leaderId}`);
    }

    const entry = {
      id: crypto.randomUUID(),
      term: this.currentTerm,
      index: this.log.length + 1,
      command,
      timestamp: Date.now()
    };

    this.log.push(entry);

    // If single node cluster, immediately commit
    if (this.peers.size === 0) {
      this.commitIndex = entry.index;
      const result = this.applyLogs();
      return { status: 'COMMITTED', entry, result };
    }

    // Trigger log replication to all peers
    this.replicateLogs();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Proposal timeout waiting for quorum commit on index ${entry.index}`));
      }, 5000);

      const onCommit = (committedEntry) => {
        if (committedEntry.index === entry.index) {
          cleanup();
          resolve({ status: 'COMMITTED', entry: committedEntry });
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.off('entryCommitted', onCommit);
      };

      this.on('entryCommitted', onCommit);
    });
  }

  /**
   * Reset the randomized election timer
   */
  resetElectionTimeout() {
    this.clearElectionTimer();
    const timeoutMs = Math.floor(
      this.minElectionTimeout + Math.random() * (this.maxElectionTimeout - this.minElectionTimeout)
    );

    this.electionTimer = setTimeout(() => {
      this.startElection();
    }, timeoutMs);
  }

  clearElectionTimer() {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
  }

  clearHeartbeatTimer() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Transition to Candidate and begin Leader Election
   */
  startElection() {
    this.role = RaftRole.CANDIDATE;
    this.currentTerm += 1;
    this.votedFor = this.nodeId;
    this.leaderId = null;

    let votesGranted = 1; // Votes for self
    const requiredVotes = this.getQuorumSize();

    this.emit('electionStarted', {
      nodeId: this.nodeId,
      term: this.currentTerm,
      requiredVotes
    });

    if (votesGranted >= requiredVotes) {
      this.becomeLeader();
      return;
    }

    this.resetElectionTimeout();

    const lastLogIndex = this.log.length;
    const lastLogTerm = lastLogIndex > 0 ? this.log[lastLogIndex - 1].term : 0;

    for (const peerId of this.peers) {
      this.sendMessage(peerId, {
        type: 'REQUEST_VOTE',
        term: this.currentTerm,
        candidateId: this.nodeId,
        lastLogIndex,
        lastLogTerm
      });
    }
  }

  /**
   * Transition to Leader
   */
  becomeLeader() {
    this.role = RaftRole.LEADER;
    this.leaderId = this.nodeId;
    this.clearElectionTimer();

    // Initialize leader volatile state
    for (const peerId of this.peers) {
      this.nextIndex.set(peerId, this.log.length + 1);
      this.matchIndex.set(peerId, 0);
    }

    this.emit('becameLeader', { nodeId: this.nodeId, term: this.currentTerm });

    // Send initial empty AppendEntries (heartbeat)
    this.replicateLogs();

    this.heartbeatTimer = setInterval(() => {
      if (this.role === RaftRole.LEADER) {
        this.replicateLogs();
      }
    }, this.heartbeatInterval);
  }

  /**
   * Replicate logs or send heartbeats to all peers
   */
  replicateLogs() {
    for (const peerId of this.peers) {
      const prevLogIndex = (this.nextIndex.get(peerId) || 1) - 1;
      const prevLogTerm = prevLogIndex > 0 && prevLogIndex <= this.log.length
        ? this.log[prevLogIndex - 1].term
        : 0;

      const entries = this.log.slice(prevLogIndex);

      this.sendMessage(peerId, {
        type: 'APPEND_ENTRIES',
        term: this.currentTerm,
        leaderId: this.nodeId,
        prevLogIndex,
        prevLogTerm,
        entries,
        leaderCommit: this.commitIndex
      });
    }
  }

  /**
   * Handle incoming Raft message
   * @param {string} fromNodeId 
   * @param {Object} message 
   */
  handleMessage(fromNodeId, message) {
    if (!message || !message.type) return;

    // Rule: If RPC request or response contains term T > currentTerm, update currentTerm and become follower
    if (message.term > this.currentTerm) {
      this.currentTerm = message.term;
      this.role = RaftRole.FOLLOWER;
      this.votedFor = null;
      this.clearHeartbeatTimer();
      this.resetElectionTimeout();
    }

    switch (message.type) {
      case 'REQUEST_VOTE':
        this.handleRequestVote(fromNodeId, message);
        break;
      case 'REQUEST_VOTE_REPLY':
        this.handleRequestVoteReply(fromNodeId, message);
        break;
      case 'APPEND_ENTRIES':
        this.handleAppendEntries(fromNodeId, message);
        break;
      case 'APPEND_ENTRIES_REPLY':
        this.handleAppendEntriesReply(fromNodeId, message);
        break;
    }
  }

  /**
   * Receiver implementation for RequestVote RPC
   */
  handleRequestVote(fromNodeId, msg) {
    let voteGranted = false;

    if (msg.term < this.currentTerm) {
      voteGranted = false;
    } else {
      const canVote = (this.votedFor === null || this.votedFor === msg.candidateId);
      const lastLogIndex = this.log.length;
      const lastLogTerm = lastLogIndex > 0 ? this.log[lastLogIndex - 1].term : 0;

      // Candidate's log must be at least as up-to-date as receiver's log
      const logOk = (msg.lastLogTerm > lastLogTerm) ||
        (msg.lastLogTerm === lastLogTerm && msg.lastLogIndex >= lastLogIndex);

      if (canVote && logOk) {
        voteGranted = true;
        this.votedFor = msg.candidateId;
        this.resetElectionTimeout();
      }
    }

    this.sendMessage(fromNodeId, {
      type: 'REQUEST_VOTE_REPLY',
      term: this.currentTerm,
      voteGranted,
      candidateId: msg.candidateId
    });
  }

  /**
   * Candidate handler for RequestVoteReply
   */
  handleRequestVoteReply(fromNodeId, msg) {
    if (this.role !== RaftRole.CANDIDATE || msg.term !== this.currentTerm) {
      return;
    }

    if (msg.voteGranted) {
      // Tally votes
      let votes = 1; // Self
      if (!this._votesCollected) this._votesCollected = new Set([this.nodeId]);
      this._votesCollected.add(fromNodeId);

      if (this._votesCollected.size >= this.getQuorumSize()) {
        this._votesCollected = null;
        this.becomeLeader();
      }
    }
  }

  /**
   * Receiver implementation for AppendEntries RPC
   */
  handleAppendEntries(fromNodeId, msg) {
    // 1. Reply false if term < currentTerm
    if (msg.term < this.currentTerm) {
      this.sendMessage(fromNodeId, {
        type: 'APPEND_ENTRIES_REPLY',
        term: this.currentTerm,
        success: false,
        matchIndex: this.log.length
      });
      return;
    }

    // Acknowledge valid leader
    this.leaderId = msg.leaderId;
    this.role = RaftRole.FOLLOWER;
    this.resetElectionTimeout();

    // 2. Reply false if log doesn't contain an entry at prevLogIndex matching prevLogTerm
    if (msg.prevLogIndex > 0) {
      const prevEntry = this.log[msg.prevLogIndex - 1];
      if (!prevEntry || prevEntry.term !== msg.prevLogTerm) {
        this.sendMessage(fromNodeId, {
          type: 'APPEND_ENTRIES_REPLY',
          term: this.currentTerm,
          success: false,
          matchIndex: this.log.length
        });
        return;
      }
    }

    // 3. Append any new entries not already in the log
    if (msg.entries && msg.entries.length > 0) {
      for (let i = 0; i < msg.entries.length; i++) {
        const entry = msg.entries[i];
        const logIndex = msg.prevLogIndex + 1 + i;
        if (this.log.length >= logIndex) {
          if (this.log[logIndex - 1].term !== entry.term) {
            // Conflict: slice log from here
            this.log = this.log.slice(0, logIndex - 1);
            this.log.push(entry);
          }
        } else {
          this.log.push(entry);
        }
      }
    }

    // 4. Update commitIndex
    if (msg.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(msg.leaderCommit, this.log.length);
      this.applyLogs();
    }

    this.sendMessage(fromNodeId, {
      type: 'APPEND_ENTRIES_REPLY',
      term: this.currentTerm,
      success: true,
      matchIndex: this.log.length
    });
  }

  /**
   * Leader handler for AppendEntriesReply
   */
  handleAppendEntriesReply(fromNodeId, msg) {
    if (this.role !== RaftRole.LEADER || msg.term !== this.currentTerm) {
      return;
    }

    if (msg.success) {
      this.nextIndex.set(fromNodeId, msg.matchIndex + 1);
      this.matchIndex.set(fromNodeId, msg.matchIndex);

      // Check if this matchIndex can be committed by quorum
      this.checkAndAdvanceCommitIndex();
    } else {
      // Decrement nextIndex and retry on failure
      const currentNext = this.nextIndex.get(fromNodeId) || 2;
      this.nextIndex.set(fromNodeId, Math.max(1, currentNext - 1));
    }
  }

  /**
   * Check if a majority of matchIndex[i] >= N, and log[N].term == currentTerm
   */
  checkAndAdvanceCommitIndex() {
    for (let n = this.log.length; n > this.commitIndex; n--) {
      if (this.log[n - 1].term === this.currentTerm) {
        let matchCount = 1; // Self matches
        for (const peerId of this.peers) {
          if ((this.matchIndex.get(peerId) || 0) >= n) {
            matchCount++;
          }
        }

        if (matchCount >= this.getQuorumSize()) {
          this.commitIndex = n;
          this.applyLogs();
          break;
        }
      }
    }
  }

  /**
   * Apply all committed but unapplied entries to the local state machine
   */
  applyLogs() {
    const applied = [];
    while (this.commitIndex > this.lastApplied) {
      this.lastApplied++;
      const entry = this.log[this.lastApplied - 1];
      const result = this.stateMachineApplier(entry.command);
      applied.push({ entry, result });
      this.emit('entryCommitted', entry);
    }
    return applied;
  }

  /**
   * Dispatch message to peer via configured transport
   */
  sendMessage(toNodeId, message) {
    if (typeof this.transportSend === 'function') {
      this.transportSend(toNodeId, message);
    } else {
      this.emit('sendRpc', { toNodeId, message });
    }
  }
}
