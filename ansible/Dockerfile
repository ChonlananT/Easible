FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
ENV TERM=xterm

# ติดตั้งแพคเกจที่จำเป็น: Ansible, nano, openssh-server (ไม่รวม PostgreSQL)
RUN apt-get update && \
    apt-get install -y \
      python3-paramiko \
      ansible \
      nano \
      openssh-server && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# สร้างและตั้งค่า SSH
RUN useradd -m admin && \
    echo 'admin:P@ssw0rd' | chpasswd && \
    mkdir /var/run/sshd && \
    sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#Port 22/Port 22/' /etc/ssh/sshd_config

# ตั้งค่า working directory เป็น /app และสร้างโฟลเดอร์ playbook กับ inventory
WORKDIR /app
RUN mkdir -p playbook inventory && chown -R admin:admin /app

# คัดลอก entrypoint script และตั้ง permission
COPY entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

# สร้าง directory /etc/ansible
RUN mkdir -p /etc/ansible

# คัดลอกไฟล์ ansible.cfg จาก host ไปยัง container
COPY ansible.cfg /etc/ansible/ansible.cfg

# เปิด port 22 สำหรับ SSH
EXPOSE 22

# รัน entrypoint script
CMD ["/app/entrypoint.sh"]
