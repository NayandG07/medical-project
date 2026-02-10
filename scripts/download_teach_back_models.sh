#!/bin/bash

# Teach-Back Model Download Script
# Downloads Whisper STT and Piper TTS models for voice processing

set -e  # Exit on error

# Configuration
LOCAL_MODELS_DIR="${LOCAL_MODELS_DIR:-/local_models}"
STT_DIR="$LOCAL_MODELS_DIR/stt"
TTS_DIR="$LOCAL_MODELS_DIR/tts"
WHISPER_MODEL="openai/whisper-large-v3"
PIPER_VERSION="v1.2.0"
PIPER_VOICE="en_US-lessac-medium"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "Teach-Back Model Download Script"
echo "================================================"
echo ""

# Check if running as root (needed for system-wide installation)
if [ "$EUID" -ne 0 ] && [ "$LOCAL_MODELS_DIR" = "/local_models" ]; then 
    echo -e "${YELLOW}Warning: Not running as root. Using user directory instead.${NC}"
    LOCAL_MODELS_DIR="$HOME/.local/models"
    STT_DIR="$LOCAL_MODELS_DIR/stt"
    TTS_DIR="$LOCAL_MODELS_DIR/tts"
fi

echo "Models will be downloaded to: $LOCAL_MODELS_DIR"
echo ""

# Create directories
echo "Creating directory structure..."
mkdir -p "$STT_DIR"
mkdir -p "$TTS_DIR"
echo -e "${GREEN}✓${NC} Directories created"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required tools
echo "Checking dependencies..."
if ! command_exists huggingface-cli; then
    echo -e "${RED}✗${NC} huggingface-cli not found"
    echo "Installing huggingface-cli..."
    pip install -U "huggingface_hub[cli]"
fi
echo -e "${GREEN}✓${NC} huggingface-cli available"

if ! command_exists wget; then
    echo -e "${RED}✗${NC} wget not found. Please install wget."
    exit 1
fi
echo -e "${GREEN}✓${NC} wget available"
echo ""

# Download Whisper model
echo "================================================"
echo "Downloading Whisper-large-v3 (~3GB)"
echo "================================================"
WHISPER_PATH="$STT_DIR/whisper-large-v3"

if [ -d "$WHISPER_PATH" ] && [ "$(ls -A $WHISPER_PATH)" ]; then
    echo -e "${YELLOW}Whisper model already exists at $WHISPER_PATH${NC}"
    read -p "Do you want to re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping Whisper download"
    else
        rm -rf "$WHISPER_PATH"
        echo "Downloading Whisper model..."
        huggingface-cli download "$WHISPER_MODEL" --local-dir "$WHISPER_PATH" --local-dir-use-symlinks False
        echo -e "${GREEN}✓${NC} Whisper model downloaded"
    fi
else
    echo "Downloading Whisper model (this may take a while)..."
    huggingface-cli download "$WHISPER_MODEL" --local-dir "$WHISPER_PATH" --local-dir-use-symlinks False
    echo -e "${GREEN}✓${NC} Whisper model downloaded"
fi
echo ""

# Download Piper TTS
echo "================================================"
echo "Downloading Piper TTS"
echo "================================================"
PIPER_BIN="$TTS_DIR/piper"

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux)
        case "$ARCH" in
            x86_64)
                PIPER_RELEASE="piper_linux_x86_64.tar.gz"
                ;;
            aarch64|arm64)
                PIPER_RELEASE="piper_linux_aarch64.tar.gz"
                ;;
            *)
                echo -e "${RED}Unsupported architecture: $ARCH${NC}"
                exit 1
                ;;
        esac
        ;;
    darwin)
        case "$ARCH" in
            x86_64)
                PIPER_RELEASE="piper_macos_x64.tar.gz"
                ;;
            arm64)
                PIPER_RELEASE="piper_macos_aarch64.tar.gz"
                ;;
            *)
                echo -e "${RED}Unsupported architecture: $ARCH${NC}"
                exit 1
                ;;
        esac
        ;;
    *)
        echo -e "${RED}Unsupported OS: $OS${NC}"
        exit 1
        ;;
esac

if [ -f "$PIPER_BIN/piper" ]; then
    echo -e "${YELLOW}Piper binary already exists at $PIPER_BIN${NC}"
    read -p "Do you want to re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping Piper download"
    else
        rm -rf "$PIPER_BIN"
        mkdir -p "$PIPER_BIN"
        echo "Downloading Piper TTS binary..."
        wget -q --show-progress "https://github.com/rhasspy/piper/releases/download/$PIPER_VERSION/$PIPER_RELEASE" -O "/tmp/$PIPER_RELEASE"
        tar -xzf "/tmp/$PIPER_RELEASE" -C "$PIPER_BIN"
        rm "/tmp/$PIPER_RELEASE"
        chmod +x "$PIPER_BIN/piper"
        echo -e "${GREEN}✓${NC} Piper binary downloaded"
    fi
else
    mkdir -p "$PIPER_BIN"
    echo "Downloading Piper TTS binary..."
    wget -q --show-progress "https://github.com/rhasspy/piper/releases/download/$PIPER_VERSION/$PIPER_RELEASE" -O "/tmp/$PIPER_RELEASE"
    tar -xzf "/tmp/$PIPER_RELEASE" -C "$PIPER_BIN"
    rm "/tmp/$PIPER_RELEASE"
    chmod +x "$PIPER_BIN/piper"
    echo -e "${GREEN}✓${NC} Piper binary downloaded"
fi
echo ""

# Download Piper voice model
echo "Downloading Piper voice model ($PIPER_VOICE)..."
VOICE_PATH="$TTS_DIR/voices"
mkdir -p "$VOICE_PATH"

if [ -f "$VOICE_PATH/${PIPER_VOICE}.onnx" ]; then
    echo -e "${YELLOW}Voice model already exists${NC}"
    read -p "Do you want to re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping voice model download"
    else
        echo "Downloading voice model..."
        huggingface-cli download rhasspy/piper-voices --include "${PIPER_VOICE}.onnx" --include "${PIPER_VOICE}.onnx.json" --local-dir "$VOICE_PATH" --local-dir-use-symlinks False
        echo -e "${GREEN}✓${NC} Voice model downloaded"
    fi
else
    echo "Downloading voice model..."
    huggingface-cli download rhasspy/piper-voices --include "${PIPER_VOICE}.onnx" --include "${PIPER_VOICE}.onnx.json" --local-dir "$VOICE_PATH" --local-dir-use-symlinks False
    echo -e "${GREEN}✓${NC} Voice model downloaded"
fi
echo ""

# Verify downloads
echo "================================================"
echo "Verifying downloads..."
echo "================================================"

# Check Whisper
if [ -d "$WHISPER_PATH" ] && [ "$(ls -A $WHISPER_PATH)" ]; then
    WHISPER_SIZE=$(du -sh "$WHISPER_PATH" | cut -f1)
    echo -e "${GREEN}✓${NC} Whisper model: $WHISPER_SIZE"
else
    echo -e "${RED}✗${NC} Whisper model verification failed"
    exit 1
fi

# Check Piper binary
if [ -f "$PIPER_BIN/piper" ] && [ -x "$PIPER_BIN/piper" ]; then
    echo -e "${GREEN}✓${NC} Piper binary: executable"
else
    echo -e "${RED}✗${NC} Piper binary verification failed"
    exit 1
fi

# Check voice model
if [ -f "$VOICE_PATH/${PIPER_VOICE}.onnx" ] && [ -f "$VOICE_PATH/${PIPER_VOICE}.onnx.json" ]; then
    VOICE_SIZE=$(du -sh "$VOICE_PATH/${PIPER_VOICE}.onnx" | cut -f1)
    echo -e "${GREEN}✓${NC} Voice model: $VOICE_SIZE"
else
    echo -e "${RED}✗${NC} Voice model verification failed"
    exit 1
fi

echo ""
echo "================================================"
echo -e "${GREEN}All models downloaded successfully!${NC}"
echo "================================================"
echo ""
echo "Model locations:"
echo "  Whisper STT: $WHISPER_PATH"
echo "  Piper TTS:   $PIPER_BIN"
echo "  Voice model: $VOICE_PATH"
echo ""
echo "Set environment variable:"
echo "  export LOCAL_MODELS_DIR=$LOCAL_MODELS_DIR"
echo ""
echo "Note: Whisper-large-v3 requires ~10GB RAM for inference"
echo "================================================"
