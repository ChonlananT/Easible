## Installation and Running

Follow these steps to install and run the project:

1. **Clone the Repository**

   Open a terminal and run:
   ```bash
   git clone https://github.com/ChonlananT/Easible.git
   cd Easible
   ```

2. **Build and Start the Containers**

   Use Docker Compose to build and start all services:
   ```bash
   docker-compose up -d --build
   ```
   This command will:
   - Build images for **db**, **ansible**, **backend**, and **frontend**.
   - Start all containers in detached mode.

3. **Verify Running Containers**

   To check that all containers are running:
   ```bash
   docker-compose ps
   ```

4. **Check Container Logs (if needed)**

   For debugging, view logs with:
   ```bash
   docker-compose logs -f
   ```

5. **Access the Services**

   - **Frontend**: Open your browser and go to [http://localhost:3000](http://localhost:3000).
   - **Backend API**: Accessible at [http://localhost:5000](http://localhost:5000) (Flask application).
   - **Database**: To inspect the database, run:
     ```bash
     docker exec -it db psql -U admin -c "\l"
     ```
   - **Ansible/SSH**: To connect via SSH, run:
     ```bash
     ssh admin@localhost -p 22
     ```
     The password is `P@ssw0rd`.

---

## Troubleshooting

- **Permission or Connection Issues**:  
  Check logs using `docker-compose logs -f` to diagnose errors.

- **Database Initialization**:  
  If the PostgreSQL container reports errors during initialization (e.g., incompatible database files), remove existing volumes with:
  ```bash
  docker-compose down -v
  ```
  Then rebuild and restart:
  ```bash
  docker-compose up -d --build
  ```

- **Environment Variables**:  
  Ensure all environment variables in `docker-compose.yml` are correctly set.

---

## Customization

- **Repository Code**:  
  You can modify the source code in the **backend** and **frontend** folders as needed.

- **Database Initialization**:  
  Update the SQL script in `db/init.sql` if you need to change the database schema or privileges.

- **Ansible Configuration**:  
  Adjust the configuration in `ansible/ansible.cfg` as necessary.
