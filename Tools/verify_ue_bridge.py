"""Unreal Engine 5.8 Bridge Verification Daemon.

Probes and verifies socket accessibility for the local Unreal Engine 5.8
Live Link / Pixel Streaming receiver port (11188) and dispatches a verification
morph target packet.
"""
import socket
import sys
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [Sarembok-Bridge] %(message)s")
LOG = logging.getLogger("UE58.LiveLink")

def test_unreal_bridge(host: str = "127.0.0.1", port: int = 11188) -> bool:
    """Verifies socket accessibility for the Unreal Engine 5.8 ARKit Live Link receiver."""
    LOG.info(f"📡 Probing Unreal Engine 5.8 Live Link listener socket on {host}:{port}...")

    # Mock dynamic morph target payload packet matching your active state mapping
    test_packet = {
        "MeshId": "ADA_V1_ARKIT",
        "Sequence": 1004,
        "Blendshapes": {
            "JawOpen": 0.34,
            "MouthSmileLeft": 0.05,
            "GazeVector": {"X": -0.99, "Y": -0.84}
        }
    }

    try:
        # Initializing local boundary connection test
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((host, port))
            LOG.info("🟢 Connection established successfully! Unreal Engine 5.8 bridge is listening.")

            # Fire sample packet payload across the local loop interface
            s.sendall(json.dumps(test_packet).encode('utf-8'))
            LOG.info("⚡ Morph target verification handshake dispatched to UE5.8 runtime.")
            return True
    except ConnectionRefusedError:
        LOG.error("❌ Port Refused: Unreal Engine is not running or the Live Link plugin is unmounted.")
        LOG.warning("💡 Action Required: Launch Unreal Engine 5.8 and verify your project streaming port is set to 11188.")
        return False
    except Exception as e:
        LOG.error(f"⚠️ Structural bridge exception: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_unreal_bridge()
    sys.exit(0 if success else 1)
