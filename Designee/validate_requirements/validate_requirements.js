const usernameDisplay = document.getElementById("usernameDisplay");

document.addEventListener('DOMContentLoaded', () => {

  const firebaseConfig = {
    apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
    authDomain: "tatak-mobile-web.firebaseapp.com",
    projectId: "tatak-mobile-web",
    storageBucket: "tatak-mobile-web.appspot.com",
    messagingSenderId: "771908675869",
    appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
    measurementId: "G-CENPP29LKQ"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  window.db = db; // make db globally accessible for flag.js

  // Expose modal elements globally
  window.validateRequirementsData = {
    checklistModal: document.getElementById("checklistModal"),
    modalBody: document.getElementById("checklistModal").querySelector(".modal-body"),
    cancelBtn: document.getElementById("cancelBtn"),
    saveBtn: document.getElementById("saveBtn"),
    approveBtn: document.getElementById("approveBtn")
  };

  const logoutBtn = document.getElementById("logoutBtn");
  const studentsTableBody = document.getElementById("studentsTableBody");
  const searchInput = document.getElementById("searchInput");
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');

  // Dropdown toggle
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      ["userData","studentName","schoolID","studentID","staffID","designeeID","category","office","department","createdByDesigneeID"]
        .forEach(key => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }

  // Designee info
  let designeeName = "Designee";
  let designeeFirstName = "";
  let designeeLastName = "";
  let designeeCategory = "";
  let designeeDepartment = "";
  let designeeOffice = "";
  let designeeUserID = null;
  let designeeFullName = "";

  const userDataString = localStorage.getItem("userData");
  if (userDataString) {
    try {
      const userDataObj = JSON.parse(userDataString);
      designeeName = userDataObj.userID || userDataObj.id || designeeName;
      designeeFirstName = userDataObj.firstName || "";
      designeeLastName = userDataObj.lastName || "";
      designeeCategory = (userDataObj.category || "").trim();
      designeeDepartment = (userDataObj.department || "").trim();
      designeeOffice = (userDataObj.office || "").trim();
      designeeUserID = userDataObj.createdByDesigneeID;
      localStorage.setItem("createdByDesigneeID", designeeUserID); // store for flag.js
    } catch (err) {
      console.error(err);
    }
  } else {
    designeeCategory = (localStorage.getItem("category") || "").trim();
    designeeDepartment = (localStorage.getItem("department") || "").trim();
    designeeOffice = (localStorage.getItem("office") || "").trim();
  }

  designeeFullName = `${designeeFirstName} ${designeeLastName}`.trim();

  if (usernameDisplay) {
    usernameDisplay.textContent = designeeFullName || designeeName;
  }

  // Load user role display
  async function loadUserRoleDisplay() {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) return;

    const userId = userData.id || userData.userID;
    const emailDiv = document.getElementById("userRoleDisplay");

    try {
      const userDoc = await db.collection("Designees").doc(userId).get();
      if (!userDoc.exists) return;

      const data = userDoc.data();
      let category = data.category || null;
      let department = data.department || null;
      let office = data.office || null;

      if (category) {
        let catDoc = await db.collection("acadClubTable").doc(category).get();
        if (!catDoc.exists) catDoc = await db.collection("groupTable").doc(category).get();
        if (!catDoc.exists) catDoc = await db.collection("labTable").doc(category).get();
        category = catDoc.exists ? (catDoc.data().club || catDoc.data().group || catDoc.data().lab) : category;
      }

      if (department) {
        const deptDoc = await db.collection("departmentTable").doc(department).get();
        department = deptDoc.exists ? deptDoc.data().department : department;
      }

      if (office) {
        const officeDoc = await db.collection("officeTable").doc(office).get();
        office = officeDoc.exists ? officeDoc.data().office : office;
      }

      let displayText = "";
      if (category) displayText = category;
      else if (department) displayText = `${department} - ${office || ""}`;
      else displayText = office || "";

      emailDiv.textContent = displayText;

    } catch (err) {
      console.error("Error loading user role:", err);
      emailDiv.textContent = "Designee";
    }
  }

  loadUserRoleDisplay();

  // Create table row HTML (flag/officer handled in flag.js)
  function createStudentRow(student) {
    return `
      <tr data-id="${student.schoolID}">
        <td>${student.schoolID || ""}</td>
        <td>${student.fullName || ""}</td>
        <td>${student.departmentDisplay || ""}</td>
        <td>${student.yearLevel || ""}</td>
        <td>
          <button class="status-button validate-button" data-studentid="${student.schoolID}">
            VALIDATE
          </button>
        </td>
        <td>
          <button class="action-button view-button" data-studentid="${student.schoolID}">
            VIEW
          </button>
        </td>
      </tr>
    `;
  }

  // Render students
  function renderStudents(students) {
    if (!students || students.length === 0) {
      studentsTableBody.innerHTML = "<tr><td colspan='6'>No students found.</td></tr>";
      return;
    }
    studentsTableBody.innerHTML = students.map(createStudentRow).join("");

    // Attach flag/officer checkboxes
    if (typeof window.attachFlagButtons === "function") {
      window.attachFlagButtons("Students");
    }
  }

  // Search handler
  function attachSearchHandler(students) {
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.toLowerCase();
      const filtered = students.filter(s =>
        s.schoolID.toLowerCase().includes(searchTerm) || s.fullName.toLowerCase().includes(searchTerm)
      );
      renderStudents(filtered);
    });
  }

  // Load students from Firestore
  async function loadStudents() {
    studentsTableBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

    try {
      const querySnapshot = await db.collection("Students").get();
      if (querySnapshot.empty) {
        studentsTableBody.innerHTML = "<tr><td colspan='6'>No students found.</td></tr>";
        return;
      }

      const allStudents = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ");
        return {
          schoolID: doc.id,
          fullName,
          departmentDisplay: data.department || "",
          yearLevel: data.yearLevel || ""
        };
      });

      renderStudents(allStudents);
      attachSearchHandler(allStudents);
    } catch (err) {
      console.error(err);
      studentsTableBody.innerHTML = "<tr><td colspan='6'>Failed to load students.</td></tr>";
    }
  }

  // Event delegation for validate and view buttons
  studentsTableBody.addEventListener("click", async (e) => {
    const validateBtn = e.target.closest(".validate-button");
    if (validateBtn) {
      const studentID = validateBtn.getAttribute("data-studentid");
      if (typeof openRequirementsModal === "function") {
        openRequirementsModal(studentID, designeeUserID, db);
      } else console.error("openRequirementsModal not found");
      return;
    }

    const viewBtn = e.target.closest(".view-button");
    if (viewBtn) {
      const studentID = viewBtn.getAttribute("data-studentid");
      if (typeof openViewClearanceCard === "function") {
        openViewClearanceCard(studentID, db);
      } else console.error("openViewClearanceCard not found");
      return;
    }
  });

  // Initial load
  loadStudents();
});
