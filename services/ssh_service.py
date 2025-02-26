import paramiko
import os

def create_ssh_connection():
    # Static values for the connection
    host = os.getenv("SSH_HOST", "127.0.0.1")
    port = int(os.getenv("SSH_PORT", 22))
    username = os.getenv("SSH_USERNAME", "admin")
    password = os.getenv("SSH_PASSWORD", "P@ssw0rd")

    # Create the SSH client and set missing host key policy
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # Connect to the SSH server with the static credentials
    ssh.connect(hostname=host, port=port, username=username, password=password)

    return ssh, username
