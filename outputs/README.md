# UniDesk · Faculty Portal

## Run it

Install Node.js 20 or newer. Open a terminal in this folder and run:

```powershell
npm start
```

Open `http://localhost:4173`. Create a faculty account with a name, staff ID, work email, and password. During initial setup, select **HR / Approver** to register the one HR account; once set up, that role cannot be self-registered again. In static mode, accounts and records are saved in the current browser's local storage.

## Faculty workflow

- **Attendance:** choose course, group, semester 1–6, subject, and date. View the class roster by student name, then mark each student Present, Absent, or Late.
- **Students:** add and manage names and roll numbers with their course, group, and semester.
- **Circulars:** publish notices for all students or a course.
- **Events & Holidays:** add campus dates by year. Republic Day, Independence Day (15 August), and Gandhi Jayanti are listed as national holidays for the selected year.
- **My HR:** faculty see only their own profile and leave requests. The HR role sees the teacher directory and approval queue; only HR can approve or decline requests. Faculty cannot access other teachers' leave records.

## Deploy as a Render Static Site

The static version keeps the portal's screens and workflows, but saves accounts and records in each visitor's browser. Data does not sync between devices or users, and clearing that browser's site data removes its records. Static hosting has no server-side authentication or shared database.

1. Put the contents of this folder in the top level of a GitHub repository, including `index.html`, `styles.css`, `app.js`, `static-api.js`, and `render.yaml`.
2. In Render, choose **New > Static Site** and connect that repository, or choose **New > Blueprint** to use `render.yaml`.
3. If setting it up as a Static Site, use an empty build command (or `echo "No build step required"`) and set **Publish Directory** to `.`. If your files are inside a subfolder in GitHub, set **Root Directory** to that folder.
4. Deploy, open the `.onrender.com` link, and create accounts in that browser. Accounts from the old site and other browsers are not transferred.

The portal runs entirely in the browser and is not connected to a college system. For shared accounts and records across different devices, a server and database are required.
