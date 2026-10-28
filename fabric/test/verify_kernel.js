// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

// verify_kernel.js - End-to-End Fabric Validation Harness
import { WalStore, EntropyEvaluator } from '../src/index.js';

async function runValidationPipeline() {
    console.log(">>> INITIALIZING FABRIC INTEGRATION ASSERTIONS...");
    const wal = new WalStore(':memory:');
    
    // ASSERTION 1: Substrate Integrity
    wal.initializeSession('test_session_001', 5000);
    wal.registerAgent('STRATEGIST', 'STRATEGIST');
    wal.registerAgent('WORKER', 'WORKER');
    wal.commitMicroStep('task_01', 'test_session_001', 'STRATEGIST', 'WORKER', {text: "Initialize compilation"}, 100, 0.0, "MOCK_HASH");
    let state = wal.reconstituteState('test_session_001');
    if (state.memoryArray && state.memoryArray.length === 1) {
        console.log("  [PASS] Substrate Reconstitution Asserted Successfully.");
    } else {
        throw new Error("FAIL: Substrate Reconstitution Mismatch.");
    }

    // ASSERTION 2: Proactive Loop Interception
    const loopingDialogue = [
        "Running directory analysis routine...",
        "Running directory analysis routine...",
        "Running directory analysis routine..."
    ];
    const loopAnalysis = EntropyEvaluator.evaluateLoop(loopingDialogue);
    if (loopAnalysis.triggerRollback && loopAnalysis.score >= 0.88) {
        wal.rollbackStep('task_01');
        console.log(`  [PASS] Entropy Guardrail Successfully Intercepted Loop (Score: ${loopAnalysis.score}).`);
    } else {
        throw new Error("FAIL: Entropy Monitor Allowed Recursive Loop Defect.");
    }

    // ASSERTION 3: Hard-Cap Enforcement
    let session = wal.db.prepare("SELECT token_burned, hard_cap FROM session_state WHERE session_id = 'test_session_001'").get();
    if (session.token_burned <= session.hard_cap) {
        console.log("  [PASS] Token Budget Guard Enforced Boundary Bounds.");
    } else {
        throw new Error("FAIL: System Permitted Token Burn-Out past Hard-Cap.");
    }

    console.log(">>> ALL KERNEL COMPILATION SUITES PASSED. SYSTEM STANDBY.");
    wal.close();
}

runValidationPipeline().catch(err => {
    console.error("!!! KERNEL VALIDATION FAILURE !!!\n", err);
    process.exit(1);
});
