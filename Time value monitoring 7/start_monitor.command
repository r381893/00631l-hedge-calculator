#!/bin/bash

# Ensure the script runs from its own directory
cd "$(dirname "$0")"

echo "=========================================="
echo "     Starting Taiwan Option Monitor..."
echo "=========================================="
echo ""

# Check for virtual environment
if [ -d "venv" ]; then
    echo "[INFO] Detected 'venv' virtual environment, activating..."
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "[INFO] Detected '.venv' virtual environment, activating..."
    source .venv/bin/activate
else
    echo "[INFO] No local virtual environment detected, using global Python..."
fi

echo ""
echo "[INFO] Starting Streamlit..."
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Determine Python command
if command_exists python3; then
    PYTHON_CMD="python3"
elif command_exists python; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python not found! Please install Python 3."
    read -p "Press any key to exit..."
    exit 1
fi

echo "[INFO] Using Python: $($PYTHON_CMD --version) at $(command -v $PYTHON_CMD)"

# Check if streamlit is installed
if ! $PYTHON_CMD -c "import streamlit" >/dev/null 2>&1; then
    echo ""
    echo "[WARN] Streamlit not found!"
    echo "Attempting to install dependencies..."
    echo ""
    $PYTHON_CMD -m pip install streamlit pandas
fi

# Check if fubon_neo is installed
if ! $PYTHON_CMD -c "import fubon_neo" >/dev/null 2>&1; then
    echo ""
    echo "[WARN] Fubon Neo API not found!"
    echo "Attempting to install local wheel file..."
    
    # Find the Mac wheel file
    WHEEL_FILE=$(ls fubon_neo*macosx*.whl 2>/dev/null | head -n 1)
    
    if [ -n "$WHEEL_FILE" ]; then
        echo "Found wheel: $WHEEL_FILE"
        $PYTHON_CMD -m pip install "$WHEEL_FILE"
        
        if [ $? -eq 0 ]; then
             echo "[INFO] Fubon Neo API installed successfully!"
        else
             echo "[ERROR] Failed to install Fubon Neo API."
        fi
    else
        echo "[ERROR] Could not find Fubon Neo Mac wheel file (fubon_neo*macosx*.whl) in current directory."
    fi
    echo ""
fi

# Run Streamlit using python -m
$PYTHON_CMD -m streamlit run app.py

# Check exit code
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Program exited with error."
    echo "Please check the error message above."
    # Keep terminal open on error
    read -p "Press any key to exit..."
fi
