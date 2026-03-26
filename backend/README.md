# CRM Backend Setup

This backend reads data directly from the Excel file `Base de Dados de Vendas.xlsx` located in the root directory.

## 1. Setup
The setup is simple since it doesn't use a database (reads directly from Excel).

### Automatic setup:
Run `install_fix.bat` in this folder.

### Manual setup:
Open a terminal in this directory (`backend`) and run:
```bash
npm install
```

## 2. Running
To run the entire project, use the `Run_CRM.bat` file in the root directory.

If you want to run only the backend:
```bash
npm start
```
The server will start at `http://localhost:3000`.
