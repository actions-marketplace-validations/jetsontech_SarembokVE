/**
 * SarembokVE Distributed State Mesh & Cluster Replicator
 * Pillar 1: Move from Local Monolith to Distributed Micro-Kernel Architecture
 * 
 * Provides:
 * - Transparent abstraction over local SQLite-WAL and distributed Raft cluster
 * - Distributed micro-step commit with quorum verification
 * - Seamless multi-region state synchronization
 * - Fallback to local WAL when operating in disconnected/edge single-node mode
 */

import { WalStore } from './wal_store.js';
import { RaftNode, RaftRole } from '../consensus/raft_consensus.js';
import crypto from 'node:crypto';

export class DistributedStateMesh {
  /**
   * @param {Object} options
   * @param {string} [options.mode='local'] 'local' | 'distributed'
   * @param {string} [options.dbPath=':memory:']
   * @param {string} [options.nodeId]
   * @param {string[]} [options.clusterPeers=[]]
   * @param {Function} [options.transportSend]
   */
  constructor(options = {}) {
    this.mode = options.mode || 'local';
    this.dbPath = options.dbPath || ':memory:';
    this.nodeId = options.nodeId || `mesh-node-${crypto.randomUUID().slice(0, 8)}`;
    this.walStore = new WalStore(this.dbPath);

    // Initialize Raft node if in distributed mode or if peers exist
    this.raftNode = new RaftNode({
      nodeId: this.nodeId,
      peers: options.clusterPeers || [],
      transportSend: options.transportSend,
      applyCommand: (cmd) => this.applyRaftCommand(cmd)
    });

    if (this.mode === 'distributed') {
      this.raftNode.start();
    }
  }

  /**
   * Apply committed Raft command to local SQLite-WAL substrate
   * @param {Object} command 
   */
  applyRaftCommand(command) {
    if (!command || !command.action) return null;

    switch (command.action) {
      case 'CREATE_SESSION':
        return this.walStore.createSession(command.sessionId, command.hardCap);

      case 'UPDATE_SESSION_STATUS':
        return this.walStore.updateSessionStatus(command.sessionId, command.status);

      case 'REGISTER_AGENT':
        return this.walStore.registerAgent(command.agentId, command.role, command.status);

      case 'COMMIT_MICRO_STEP':
        return this.walStore.commitMicroStep({
          taskId: command.taskId,
          sessionId: command.sessionId,
          senderAgentId: command.senderAgentId,
          recipientAgentId: command.recipientAgentId,
          payload: command.payload,
          tokensConsumed: command.tokensConsumed,
          entropyScore: command.entropyScore,
          validationHash: command.validationHash,
          stateSnapshotHash: command.stateSnapshotHash
        });

      case 'ROLLBACK_STEP':
        return this.walStore.rollbackStep(command.taskId);

      default:
        console.warn(`[DistributedStateMesh] Unknown command action: ${command.action}`);
        return null;
    }
  }

  /**
   * Initialize a new session across the distributed mesh
   */
  async createSession(sessionId, hardCap = 100000) {
    if (this.mode === 'distributed' && this.raftNode.peers.size > 0) {
      const proposal = {
        action: 'CREATE_SESSION',
        sessionId,
        hardCap,
        originNodeId: this.nodeId
      };
      await this.raftNode.propose(proposal);
      return this.walStore.getSession(sessionId);
    }

    return this.walStore.createSession(sessionId, hardCap);
  }

  /**
   * Commit a micro-step with distributed quorum guarantees
   */
  async commitMicroStep(stepData) {
    if (this.mode === 'distributed' && this.raftNode.peers.size > 0) {
      const proposal = {
        action: 'COMMIT_MICRO_STEP',
        ...stepData,
        originNodeId: this.nodeId
      };
      await this.raftNode.propose(proposal);
      return this.walStore.getLatestTransaction(stepData.sessionId);
    }

    return this.walStore.commitMicroStep(stepData);
  }

  /**
   * Reconstitute complete state from WAL
   */
  reconstituteState(sessionId) {
    return this.walStore.getAllCommittedTransactions(sessionId);
  }

  /**
   * Cluster node inspection
   */
  getClusterStatus() {
    return {
      nodeId: this.nodeId,
      mode: this.mode,
      role: this.raftNode.role,
      currentTerm: this.raftNode.currentTerm,
      leaderId: this.raftNode.leaderId,
      peers: Array.from(this.raftNode.peers),
      logLength: this.raftNode.log.length,
      commitIndex: this.raftNode.commitIndex,
      isLeader: this.raftNode.role === RaftRole.LEADER
    };
  }

  /**
   * Shutdown mesh and store
   */
  close() {
    if (this.raftNode) {
      this.raftNode.stop();
    }
    if (this.walStore) {
      this.walStore.close();
    }
  }
}
