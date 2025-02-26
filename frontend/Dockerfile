FROM node:18-alpine

# ติดตั้ง git ใน Alpine
RUN apk update && apk add --no-cache git

# กำหนด working directory
WORKDIR /app

# Clone repository จาก GitHub โดยใช้ branch "Frontend"
RUN git clone -b Frontend https://github.com/ChonlananT/Easible.git .

# คัดลอก package.json (และ package-lock.json ถ้ามี) แล้วติดตั้ง dependencies
# (ในกรณีนี้ไฟล์ package*.json ถูก clone มาพร้อมกับ source code)
RUN npm install

# คัดลอก source codeทั้งหมด (หากมีไฟล์อื่นๆ ที่เปลี่ยนแปลงภายหลัง clone)
COPY . .

# รันแอพ Typescript ตามที่ระบุใน script "start" ใน package.json
CMD ["npm", "run", "start"]
