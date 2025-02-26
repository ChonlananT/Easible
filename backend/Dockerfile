FROM python:3.9-slim

# ติดตั้ง openssh-client สำหรับใช้งาน ssh command และติดตั้ง dependencies อื่น ๆ
RUN apt-get update && \
    apt-get install -y iputils-ping openssh-client git gcc libpq-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Clone repository จาก GitHub โดยใช้ branch "Backend"
RUN git clone -b Backend https://github.com/ChonlananT/Easible.git .

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "app.py"]
