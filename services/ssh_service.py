import paramiko

def create_ssh_connection():
    # Static values for the connection
    host = "127.0.0.1"
    port = 3022
    username = "suphanath"
    password = "Admin!1234"

    # Create the SSH client and set missing host key policy
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # Connect to the SSH server with the static credentials
    ssh.connect(hostname=host, port=port, username=username, password=password)

    return ssh, username
