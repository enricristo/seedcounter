import subprocess
import sys

def main():
    try:
        print("Running Pre-Commit Checks...")

        # Run tests
        print("1. Running Tests...")
        # Since I've set it to `vitest run`, it will run once and exit
        subprocess.run(["npm", "run", "test"], check=True)

        print("All pre-commit checks passed successfully!")

    except subprocess.CalledProcessError as e:
        print(f"Pre-commit check failed during step {e.cmd}")
        sys.exit(e.returncode)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
