import subprocess

def run_tests():
    try:
        subprocess.check_call(['npx', 'vitest', 'run', 'src/lib/calibration.test.ts'])
        print("Tests passed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Tests failed with exit code: {e.returncode}")

run_tests()
