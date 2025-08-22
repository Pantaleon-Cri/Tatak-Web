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
    approveBtn: document.getElementById("approveBtn"),
  };

  const logoutBtn = document.getElementById("logoutBtn");
  const studentsTableBody = document.getElementById("studentsTableBody");
  const searchInput = document.getElementById("searchInput");
  const usernameDisplay = document.getElementById("usernameDisplay");
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');

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

  // Get designee info
  let designeeName = "Designee", designeeCategory = "", designeeDepartment = "", designeeOffice = "", designeeUserID = null;
  const userDataString = localStorage.getItem("userData");
  if (userDataString) {
    try {
      const userDataObj = JSON.parse(userDataString);
      designeeName = userDataObj.userID || userDataObj.id || designeeName;
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

  usernameDisplay.textContent = designeeName;

  // Row HTML
  function createStudentRow(student) {
    return `
      <tr>
        <td>${student.schoolID || ""}</td>
        <td>${student.fullName || ""}</td>
        <td>${student.departmentDisplay || ""}</td>
        <td>${student.yearLevel || ""}</td>
        <td><button class="status-button validate-button" data-studentid="${student.schoolID}">VALIDATE</button></td>
        <td><button class="action-button view-button">VIEW</button></td>
      </tr>
    `;
  }

  // Load students
  async function loadStudents() {
  studentsTableBody.innerHTML = "<tr><td colspan='8'>Loading...</td></tr>";

  try {
    // 1️⃣ Departments map
    const deptSnapshot = await db.collection("departmentTable").get();
    const departmentMap = {};
    deptSnapshot.forEach(doc => {
      const data = doc.data();
      departmentMap[doc.id] = data.code || doc.id;
    });

    // 2️⃣ Students
    let querySnapshot;
    const personalCollectionOffices = ["301","311","312","313","314"];
    const usePersonalCollection = personalCollectionOffices.includes(designeeOffice) && designeeCategory !== "401";

    if (usePersonalCollection && designeeCategory) {
      querySnapshot = await db.collection(designeeCategory).get(); // personal collection
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
        department: data.department || "", // ✅ keep raw department (e.g. "05")
        departmentDisplay: deptDisplay,
        yearLevel: data.yearLevel || "",
        email: data.institutionalEmail || data.gmail || "",
        clubs: Array.isArray(data.clubs) ? data.clubs.map(c => String(c).toLowerCase()) : []
      });
    });

    // 🔹 Filter students
    let filteredStudents = [];
    const normalizedDesigneeDepartment = designeeDepartment || "";
    const isCategoryEmpty = !designeeCategory || designeeCategory.toLowerCase() === "n/a";
    const isDepartmentEmpty = !designeeDepartment || designeeDepartment.toLowerCase() === "n/a";

    if (designeeOffice === "309") {
      // Clubs office: filter by clubs matching category
      const designeeCategories = designeeCategory.split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
      filteredStudents = allStudents.filter(student => student.clubs.some(club => designeeCategories.includes(club)));
    } else if (designeeOffice === "307" || designeeOffice === "308") {
      // ✅ Office 307 & 308: filter students with the same department
      filteredStudents = allStudents.filter(student => student.department === normalizedDesigneeDepartment);
    } else if (usePersonalCollection) {
      filteredStudents = allStudents; // Only show their personal collection
    } else if (!isDepartmentEmpty) {
      filteredStudents = allStudents.filter(student => student.department.toLowerCase() === normalizedDesigneeDepartment.toLowerCase());
    } else if (isCategoryEmpty && isDepartmentEmpty) {
      filteredStudents = allStudents;
    } else {
      filteredStudents = allStudents;
    }

    renderStudents(filteredStudents);
    attachSearchHandler(filteredStudents);
    attachValidateButtonHandler();

  } catch (err) {
    console.error(err);
    studentsTableBody.innerHTML = "<tr><td colspan='8'>Failed to load students.</td></tr>";
  }
}


  function renderStudents(students) {
    if (students.length === 0) {
      studentsTableBody.innerHTML = "<tr><td colspan='8'>No students found.</td></tr>";
      return;
    }
    studentsTableBody.innerHTML = students.map(createStudentRow).join("");
  }

  function attachSearchHandler(students) {
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.toLowerCase();
      const filtered = students.filter(s =>
        s.schoolID.toLowerCase().includes(searchTerm) || s.fullName.toLowerCase().includes(searchTerm)
      );
      renderStudents(filtered);
      attachValidateButtonHandler();
    });
  }

  function attachValidateButtonHandler() {
    const validateButtons = document.querySelectorAll(".validate-button");
    validateButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const studentID = btn.getAttribute("data-studentid");
        const currentUser = JSON.parse(localStorage.getItem("userData")) || {};
        const currentUserID = currentUser?.id || currentUser?.userID || designeeUserID;
        if (typeof openRequirementsModal === "function") {
          openRequirementsModal(studentID, currentUserID, db);
        } else {
          console.error("openRequirementsModal not found");
        }
      });
    });
  }

  loadStudents();
});
