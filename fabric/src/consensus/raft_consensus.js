// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

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
import http from 'node:http';

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
    this.rpcServer = null;
    this.rpcPort = null;

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
    this.stopRpcServer();
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
   * Get the SHA-256 Merkle hash of the latest log entry (or genesis zeros)
   * @returns {string} 64-char hex SHA-256 hash
   */
  getLastLogHash() {
    return this.log.length > 0 ? this.log[this.log.length - 1].entryHash : '0'.repeat(64);
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

    const prevHash = this.log.length > 0 ? this.log[this.log.length - 1].entryHash : '0'.repeat(64);
    const index = this.log.length + 1;
    const entryHash = crypto
      .createHash('sha256')
      .update(`${this.currentTerm}:${index}:${prevHash}:${JSON.stringify(command)}`)
      .digest('hex');

    const entry = {
      id: crypto.randomUUID(),
      term: this.currentTerm,
      index,
      command,
      prevHash,
      entryHash,
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
   * Replays and verifies the SHA-256 Merkle hash chain from genesis
   * Throws a cryptographic tamper error if any log frame was modified
   * @returns {{ verified: boolean, entriesCount: number, headHash: string }}
   */
  verifyIntegrity() {
    let expectedPrevHash = '0'.repeat(64);
    for (let i = 0; i < this.log.length; i++) {
      const entry = this.log[i];
      if (entry.prevHash && entry.prevHash !== expectedPrevHash) {
        throw new Error(
          `Raft log chain broken at index ${entry.index}: expected prevHash ${expectedPrevHash}, got ${entry.prevHash}`
        );
      }
      const calculatedHash = crypto
        .createHash('sha256')
        .update(`${entry.term}:${entry.index}:${expectedPrevHash}:${JSON.stringify(entry.command)}`)
        .digest('hex');
      if (entry.entryHash && entry.entryHash !== calculatedHash) {
        throw new Error(
          `Cryptographic tamper detected in Raft log at index ${entry.index}: expected entryHash ${calculatedHash}, got ${entry.entryHash}`
        );
      }
      expectedPrevHash = entry.entryHash || calculatedHash;
    }
    return {
      verified: true,
      entriesCount: this.log.length,
      headHash: expectedPrevHash
    };
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

  /**
   * Start a lightweight, zero-dependency Node HTTP RPC listener for multi-node Raft clusters
   * Handles POST /raft/request-vote and POST /raft/append-entries
   * @param {number} [port=0] Port to listen on (0 for dynamic port)
   * @returns {Promise<number>} Bound port
   */
  startRpcServer(port = 0) {
    if (this.rpcServer) return Promise.resolve(this.rpcPort);

    return new Promise((resolve, reject) => {
      this.rpcServer = http.createServer((req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let payload;
          try {
            payload = body ? JSON.parse(body) : {};
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            return;
          }

          if (req.url === '/raft/request-vote') {
            const result = this.processRequestVoteHttp(payload);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else if (req.url === '/raft/append-entries') {
            const result = this.processAppendEntriesHttp(payload);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
          }
        });
      });

      this.rpcServer.on('error', reject);
      this.rpcServer.listen(port, '127.0.0.1', () => {
        const addr = this.rpcServer.address();
        this.rpcPort = typeof addr === 'object' && addr ? addr.port : port;
        resolve(this.rpcPort);
      });
    });
  }

  /**
   * Stop the HTTP RPC listener and clean up timers and sockets
   */
  stopRpcServer() {
    this.clearElectionTimer();
    this.clearHeartbeatTimer();
    return new Promise((resolve) => {
      if (!this.rpcServer) return resolve();
      try {
        if (typeof this.rpcServer.closeAllConnections === 'function') {
          this.rpcServer.closeAllConnections();
        }
      } catch {}
      this.rpcServer.close(() => {
        this.rpcServer = null;
        this.rpcPort = null;
        resolve();
      });
    });
  }

  /**
   * Process incoming HTTP RequestVote RPC
   * @param {Object} payload 
   * @returns {Object} { term, voteGranted, candidateId }
   */
  processRequestVoteHttp(payload) {
    if (!payload || typeof payload !== 'object') {
      return { term: this.currentTerm, voteGranted: false, reason: 'Invalid payload' };
    }

    if (payload.term > this.currentTerm) {
      this.currentTerm = payload.term;
      this.role = RaftRole.FOLLOWER;
      this.votedFor = null;
      this.clearHeartbeatTimer();
      this.resetElectionTimeout();
    }

    let voteGranted = false;
    if (payload.term < this.currentTerm) {
      voteGranted = false;
    } else {
      const canVote = (this.votedFor === null || this.votedFor === payload.candidateId);
      const lastLogIndex = this.log.length;
      const lastLogTerm = lastLogIndex > 0 ? this.log[lastLogIndex - 1].term : 0;

      const logOk = (payload.lastLogTerm > lastLogTerm) ||
        (payload.lastLogTerm === lastLogTerm && (payload.lastLogIndex || 0) >= lastLogIndex);

      if (canVote && logOk) {
        voteGranted = true;
        this.votedFor = payload.candidateId;
        this.resetElectionTimeout();
      }
    }

    return {
      term: this.currentTerm,
      voteGranted,
      candidateId: payload.candidateId
    };
  }

  /**
   * Process incoming HTTP AppendEntries RPC with SHA-256 Merkle chain verification
   * @param {Object} payload 
   * @returns {Object} { term, success, matchIndex, lastEntryHash }
   */
  processAppendEntriesHttp(payload) {
    if (!payload || typeof payload !== 'object') {
      return { term: this.currentTerm, success: false, reason: 'Invalid payload' };
    }

    // 1. Reply false if term < currentTerm
    if (payload.term < this.currentTerm) {
      return {
        term: this.currentTerm,
        success: false,
        matchIndex: this.log.length,
        lastEntryHash: this.log.length > 0 ? this.log[this.log.length - 1].entryHash : '0'.repeat(64),
        reason: 'Leader term is stale'
      };
    }

    // 2. Rule: If RPC term > currentTerm, update currentTerm and step down
    if (payload.term > this.currentTerm) {
      this.currentTerm = payload.term;
      this.role = RaftRole.FOLLOWER;
      this.votedFor = null;
      this.clearHeartbeatTimer();
      this.resetElectionTimeout();
    }

    this.leaderId = payload.leaderId;
    this.role = RaftRole.FOLLOWER;
    this.resetElectionTimeout();

    // 3. Merkle Chain & Log Verification
    if (payload.prevLogIndex > 0) {
      const prevEntry = this.log[payload.prevLogIndex - 1];
      if (!prevEntry || prevEntry.term !== payload.prevLogTerm) {
        return {
          term: this.currentTerm,
          success: false,
          matchIndex: this.log.length,
          lastEntryHash: this.log.length > 0 ? this.log[this.log.length - 1].entryHash : '0'.repeat(64),
          reason: 'prevLogIndex/term mismatch'
        };
      }
      if (payload.prevLogHash && prevEntry.entryHash && prevEntry.entryHash !== payload.prevLogHash) {
        return {
          term: this.currentTerm,
          success: false,
          matchIndex: this.log.length,
          lastEntryHash: prevEntry.entryHash,
          reason: 'prevLogHash Merkle link mismatch'
        };
      }
    }

    // 4. Append entries with Merkle verification
    if (payload.entries && Array.isArray(payload.entries) && payload.entries.length > 0) {
      for (let i = 0; i < payload.entries.length; i++) {
        const rawEntry = payload.entries[i];
        const logIndex = (payload.prevLogIndex || 0) + 1 + i;

        const prevHash = this.log.length > 0
          ? this.log[this.log.length - 1].entryHash
          : (payload.prevLogHash || '0'.repeat(64));

        const expectedHash = crypto
          .createHash('sha256')
          .update(`${rawEntry.term}:${logIndex}:${prevHash}:${JSON.stringify(rawEntry.command)}`)
          .digest('hex');

        const entry = {
          id: rawEntry.id || crypto.randomUUID(),
          term: rawEntry.term,
          index: logIndex,
          command: rawEntry.command,
          prevHash: rawEntry.prevHash || prevHash,
          entryHash: rawEntry.entryHash || expectedHash,
          timestamp: rawEntry.timestamp || Date.now()
        };

        if (this.log.length >= logIndex) {
          if (this.log[logIndex - 1].term !== entry.term) {
            this.log = this.log.slice(0, logIndex - 1);
            this.log.push(entry);
          } else {
            this.log[logIndex - 1] = entry;
          }
        } else {
          this.log.push(entry);
        }
      }
    }

    // 5. Verify local log integrity
    this.verifyIntegrity();

    // 6. Update commit index
    if (payload.leaderCommit !== undefined && payload.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(payload.leaderCommit, this.log.length);
      this.applyLogs();
    }

    const lastEntryHash = this.log.length > 0
      ? this.log[this.log.length - 1].entryHash
      : '0'.repeat(64);

    return {
      term: this.currentTerm,
      success: true,
      matchIndex: this.log.length,
      lastEntryHash
    };
  }

  /**
   * Replicate proposed Merkle log entry to a live peer over HTTP
   * @param {string} peerUrl Base URL (e.g. 'http://127.0.0.1:9091') or endpoint URL
   * @param {Object} [entry] Entry to replicate (defaults to latest log entry)
   * @returns {Promise<Object>} Peer response
   */
  async replicateToPeer(peerUrl, entry = null) {
    const entries = entry ? [entry] : (this.log.length > 0 ? [this.log[this.log.length - 1]] : []);
    const prevLogIndex = this.log.length - entries.length;
    const prevEntry = prevLogIndex > 0 && prevLogIndex <= this.log.length ? this.log[prevLogIndex - 1] : null;
    const prevLogTerm = prevEntry ? prevEntry.term : 0;
    const prevLogHash = prevEntry ? prevEntry.entryHash : '0'.repeat(64);

    const payload = {
      term: this.currentTerm,
      leaderId: this.nodeId,
      prevLogIndex,
      prevLogTerm,
      prevLogHash,
      entries,
      leaderCommit: this.commitIndex
    };

    const targetUrl = peerUrl.endsWith('/raft/append-entries')
      ? peerUrl
      : `${peerUrl.replace(/\/$/, '')}/raft/append-entries`;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Replication failed to ${peerUrl} with HTTP ${res.status}`);
    }

    return await res.json();
  }
}


