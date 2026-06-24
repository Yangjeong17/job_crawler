import os
import subprocess
import sys


def main():
    app_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gui", "app.py")
    subprocess.run([
        sys.executable, "-m", "streamlit", "run", app_path,
        "--server.headless", "true",
    ])


if __name__ == "__main__":
    main()
