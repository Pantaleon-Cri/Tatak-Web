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

  // Expose modal elements globally
  window.validateRequirementsData = {
    checklistModal: document.getElementById("checklistModal"),
    modalBody: document.getElementById("checklistModal").querySelector(".modal-body"),
    cancelBtn: document.getElementById("cancelBtn"),
    saveBtn: document.getElementById("saveBtn"),
    approveBtn: document.getElementById("approveBtn") // may be null if not in HTML
  };

  const logoutBtn = document.getElementById("logoutBtn");
  const studentsTableBody = document.getElementById("studentsTableBody");
  const searchInput = document.getElementById("searchInput");
  const usernameDisplay = document.getElementById("usernameDisplay");
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
      ["userData","studentName","schoolID","studentID","staffID","designeeID","category","office","department"]
        .forEach(key => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }

  // Designee info
  let designeeName = "Designee";
  let designeeFirstName = "";
  let designeeCategory = "";
  let designeeDepartment = "";
  let designeeOffice = "";
  let designeeUserID = null;

  const userDataString = localStorage.getItem("userData");
  if (userDataString) {
    try {
      const userDataObj = JSON.parse(userDataString);
      designeeName = userDataObj.userID || userDataObj.id || designeeName;
      designeeFirstName = userDataObj.firstName || "";
      designeeCategory = (userDataObj.category || "").trim();
      designeeDepartment = (userDataObj.department || "").trim();
      designeeOffice = (userDataObj.office || "").trim();
      designeeUserID = designeeName;
    } catch (err) { console.error(err); }
  } else {
    designeeCategory = (localStorage.getItem("category") || "").trim();
    designeeDepartment = (localStorage.getItem("department") || "").trim();
    designeeOffice = (localStorage.getItem("office") || "").trim();
  }

  usernameDisplay.textContent = designeeFirstName;

  // Load user role display
  async function loadUserRoleDisplay() {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) return;

    const userId = userData.id;
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

  // Create table row HTML
  function createStudentRow(student) {
    return `
      <tr>
        <td>${student.schoolID || ""}</td>
        <td>${student.fullName || ""}</td>
        <td>${student.departmentDisplay || ""}</td>
        <td>${student.yearLevel || ""}</td>
        <td><button class="status-button validate-button" data-studentid="${student.schoolID}">VALIDATE</button></td>
        <td><button class="action-button view-button" data-studentid="${student.schoolID}">VIEW</button></td>
      </tr>
    `;
  }

  // Render students
  function renderStudents(students) {
    if (!students || students.length === 0) {
      studentsTableBody.innerHTML = "<tr><td colspan='8'>No students found.</td></tr>";
      return;
    }
    studentsTableBody.innerHTML = students.map(createStudentRow).join("");
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
    studentsTableBody.innerHTML = "<tr><td colspan='8'>Loading...</td></tr>";

    try {
      const deptSnapshot = await db.collection("departmentTable").get();
      const departmentMap = {};
      deptSnapshot.forEach(doc => {
        const data = doc.data();
        departmentMap[doc.id] = data.code || doc.id;
      });

      const groupSnapshot = await db.collection("groupTable").get();
      const labSnapshot = await db.collection("labTable").get();
      const collectionMap = {};

      groupSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.id && data.club) collectionMap[String(data.id)] = data.club;
      });
      labSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.id && data.lab) collectionMap[String(data.id)] = data.lab;
      });

      let querySnapshot;
      const personalOffices = ["301","310","311","312","313","314"];
      const excludeCategories = ["401","403"];

      if (personalOffices.includes(designeeOffice) && !excludeCategories.includes(designeeCategory)) {
        const collectionName = collectionMap[designeeCategory];
        if (!collectionName) {
          studentsTableBody.innerHTML = "<tr><td colspan='8'>No matching collection found for this category.</td></tr>";
          return;
        }
        querySnapshot = await db.collection(collectionName).get();
      } else {
        querySnapshot = await db.collection("Students").get();
      }

      if (querySnapshot.empty) {
        studentsTableBody.innerHTML = "<tr><td colspan='8'>No students found.</td></tr>";
        return;
      }

      const allStudents = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ");
        let deptDisplay = data.department || "";
        if (deptDisplay && departmentMap[deptDisplay]) deptDisplay = departmentMap[deptDisplay];

        allStudents.push({
          schoolID: doc.id,
          fullName,
          course: data.course || "",
          department: data.department || "",
          departmentDisplay: deptDisplay,
          yearLevel: data.yearLevel || "",
          email: data.institutionalEmail || data.gmail || "",
          clubs: Array.isArray(data.clubs) ? data.clubs.map(c => String(c).toLowerCase()) : []
        });
      });

      // Filtering
      let filteredStudents = [];
      const showAllCategories = ["401","403"];
      const showAllOffices = ["302","303","304","305","306"];

      if (showAllCategories.includes(designeeCategory) || showAllOffices.includes(designeeOffice)) {
        filteredStudents = allStudents;
      } else if (designeeOffice === "307" || designeeOffice === "308") {
        filteredStudents = allStudents.filter(student => student.department === designeeDepartment);
      } else if (designeeOffice === "309") {
        const designeeClubs = designeeCategory.split(",").map(c => c.trim().toLowerCase());
        filteredStudents = allStudents.filter(student => student.clubs.some(club => designeeClubs.includes(club)));
      } else if (personalOffices.includes(designeeOffice) && !excludeCategories.includes(designeeCategory)) {
        filteredStudents = allStudents;
      } else {
        filteredStudents = allStudents;
      }

      renderStudents(filteredStudents);
      attachSearchHandler(filteredStudents);

    } catch (err) {
      console.error(err);
      studentsTableBody.innerHTML = "<tr><td colspan='8'>Failed to load students.</td></tr>";
    }
  }

  // Event delegation for validate and view buttons
  studentsTableBody.addEventListener("click", (e) => {
    const validateBtn = e.target.closest(".validate-button");
    if (validateBtn) {
      const studentID = validateBtn.getAttribute("data-studentid");
      const currentUser = JSON.parse(localStorage.getItem("userData")) || {};
      const currentUserID = currentUser?.id || currentUser?.userID || designeeUserID;
      if (typeof openRequirementsModal === "function") {
        openRequirementsModal(studentID, currentUserID, db);
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
