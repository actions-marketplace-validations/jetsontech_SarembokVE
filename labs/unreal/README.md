# SarembokVE Unreal Engine Environment (Labs)

This directory contains the experimental 3D Unreal Engine interactive runtime and MetaHuman visualization pipeline for SarembokVE.

## Structure

- **`SarembokVE.uproject`**: Unreal Engine 5 project descriptor.
- **`Plugins/SarembokAgent/`**: C++ agent integration plugin bridging Unreal runtime to Sarembok WebSocket RPC.
- **`Source/`**: Native Unreal Engine C++ module source code.
- **`Content/`**: MetaHuman asset descriptors, ARKit 52-blendshape topologies, and virtual environments.
- **`Config/`**: Engine and input configuration for Unreal Engine.

## Quick Launch

To launch the Unreal Engine editor:
```powershell
./Launch-SarembokUnreal.ps1
```
Or open `SarembokVE.uproject` directly in Unreal Engine 5.
