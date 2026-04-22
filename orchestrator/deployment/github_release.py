import subprocess


def github_preflight() -> dict[str, str]:
    commands = [
        ["git", "status", "--short"],
        ["git", "remote", "-v"],
    ]
    output = {}
    for cmd in commands:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        output[" ".join(cmd)] = (result.stdout or result.stderr).strip()
    return output
