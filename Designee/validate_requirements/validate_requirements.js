const usernameDisplay = document.getElementById("usernameDisplay");

document.addEventListener('DOMContentLoaded', async () => {

  // -------------------- Firebase Initialization --------------------
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
  window.db = db;

  // -------------------- DOM Elements --------------------
  const logoutBtn = document.getElementById("logoutBtn");
  const studentsTableBody = document.getElementById("studentsTableBody");
  const searchInput = document.getElementById("searchInput");
  const filterDepartment = document.getElementById("filterDepartment");
  const filterYear = document.getElementById("filterYear");
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');

  // -------------------- Dropdown Toggle --------------------
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

  // -------------------- Logout --------------------
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      [
        "userData", "studentName", "schoolID", "studentID", "staffID",
        "designeeID", "category", "office", "department", "createdByDesigneeID"
      ].forEach(key => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }

  // -------------------- Designee Info --------------------
  let designeeName = "Designee";
  let designeeFullName = "";
  let designeeID = null;

  const userDataString = localStorage.getItem("userData");
  let userDataObj = null;
  if (userDataString) {
    try {
      userDataObj = JSON.parse(userDataString);
      designeeName = userDataObj.userID || userDataObj.id || designeeName;
      designeeFullName = [userDataObj.firstName, userDataObj.lastName].filter(Boolean).join(" ");
      designeeID = userDataObj.role === "designee" ? userDataObj.id : userDataObj.createdByDesigneeID || null;
    } catch (err) {
      console.error("Failed to parse userData:", err);
    }
  }
  if (usernameDisplay) usernameDisplay.textContent = designeeFullName || designeeName;

  // -------------------- Department & YearLevel Mappings --------------------
  const departmentMap = {};
  const yearLevelMap = {};

  async function loadMappings() {
    try {
      const depSnapshot = await db.collection("DataTable").doc("Department").collection("DepartmentDocs").get();
      depSnapshot.docs.forEach(doc => {
        const data = doc.data();
        departmentMap[doc.id] = data.name || data.code || doc.id;
      });

      const ylSnapshot = await db.collection("DataTable").doc("YearLevel").collection("YearLevelDocs").get();
      ylSnapshot.docs.forEach(doc => {
        const data = doc.data();
        yearLevelMap[doc.id] = data.yearLevel || data.name || doc.id;
      });
    } catch (err) {
      console.error("Failed to load mappings", err);
    }
  }

  // -------------------- Populate Header Filters --------------------
  function populateHeaderFilters(students) {
    if (!filterDepartment || !filterYear) return;

    filterDepartment.innerHTML = '<option value="">All</option>';
    filterYear.innerHTML = '<option value="">All</option>';

    for (const [id, name] of Object.entries(departmentMap)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      filterDepartment.appendChild(option);
    }

    for (const [id, name] of Object.entries(yearLevelMap)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      filterYear.appendChild(option);
    }

    attachFilterHandlers(students);
  }

  // -------------------- Filter & Search Handler --------------------
  function attachFilterHandlers(students) {
    if (!filterDepartment || !filterYear || !students) return;

    const applyFilters = () => {
      const deptVal = filterDepartment.value;
      const yearVal = filterYear.value;
      const searchTerm = searchInput?.value?.toLowerCase() || "";

      const filtered = students.filter(s => {
        return (!deptVal || s.originalDepartmentId === deptVal) &&
               (!yearVal || s.yearLevelId === yearVal) &&
               (s.schoolID.toLowerCase().includes(searchTerm) || s.fullName.toLowerCase().includes(searchTerm));
      });

      renderStudents(filtered);
    };

    filterDepartment.addEventListener("change", applyFilters);
    filterYear.addEventListener("change", applyFilters);

    if (searchInput) {
      searchInput.addEventListener("input", applyFilters);
    }
  }

  // -------------------- Create Student Row --------------------
  function createStudentRow(student) {
    const isIncompleteChecked = Array.isArray(student.incomplete) && student.incomplete.includes(designeeID);
    const isViolationChecked = Array.isArray(student.violations) && student.violations.includes(designeeID);
    const isOfficerChecked = Array.isArray(student.officers) && student.officers.includes(designeeID);

    return `
      <tr data-id="${student.schoolID}">
        <td><input type="checkbox" class="role-checkbox incomplete-checkbox" data-studentid="${student.schoolID}" ${isIncompleteChecked ? "checked" : ""} /></td>
        <td><input type="checkbox" class="role-checkbox violation-checkbox" data-studentid="${student.schoolID}" ${isViolationChecked ? "checked" : ""} /></td>
        <td><input type="checkbox" class="role-checkbox officer-checkbox" data-studentid="${student.schoolID}" ${isOfficerChecked ? "checked" : ""} /></td>
        <td>${student.schoolID || ""}</td>
        <td>${student.fullName || ""}</td>
        <td>${student.department || ""}</td>
        <td>${student.yearLevel || ""}</td>
        <td class="prereq-cell" data-studentid="${student.schoolID}">Loading...</td>
        <td><button class="status-button validate-button" data-studentid="${student.schoolID}">VALIDATE</button></td>
        <td><button class="action-button view-button" data-studentid="${student.schoolID}">VIEW</button></td>
      </tr>
    `;
  }

  // -------------------- Render Students --------------------
  function renderStudents(students) {
    if (!students || students.length === 0) {
      studentsTableBody.innerHTML = "<tr><td colspan='10'>No students found.</td></tr>";
      return;
    }
    studentsTableBody.innerHTML = students.map(createStudentRow).join("");

    if (typeof populatePrerequisites === "function") {
      populatePrerequisites(students, userDataObj);
    }

    // Run modal checks in parallel without blocking
    if (typeof openRequirementsModal === "function") {
      Promise.all(
        students.map(stu => 
          openRequirementsModal(stu.schoolID, designeeID, db, { autoRun: true })
            .catch(err => console.error(`Modal check failed for ${stu.schoolID}:`, err))
        )
      );
    }
  }

  // -------------------- Batch Validation Helper --------------------
  async function validateInBatches(students, batchSize = 20) {
    console.log(`Starting validation for ${students.length} students in batches of ${batchSize}...`);
    
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(student => 
          autoValidateRequirements(designeeID, student.schoolID)
            .catch(err => console.error(`Validation failed for ${student.schoolID}:`, err))
        )
      );
      
      const completed = Math.min(i + batchSize, students.length);
      console.log(`Validated ${completed}/${students.length} students`);
    }
    
    console.log("All validations complete!");
  }

  // -------------------- Load Students --------------------
  async function loadStudents() {
    studentsTableBody.innerHTML = "<tr><td colspan='10'>Loading...</td></tr>";

    try {
      // Run queries in parallel
      const [semesterSnapshot, snapshot] = await Promise.all([
        db.collection("DataTable").doc("Semester").collection("SemesterDocs")
          .where("currentSemester", "==", true).limit(1).get(),
        db.collection("User").doc("Students").collection("StudentsDocs").get()
      ]);

      if (semesterSnapshot.empty) {
        studentsTableBody.innerHTML = "<tr><td colspan='10'>No current semester found.</td></tr>";
        return;
      }

      const currentSemesterId = semesterSnapshot.docs[0].id;

      let office, currentCategory, currentDepartment;
      if (userDataObj) {
        office = userDataObj.office;
        currentCategory = userDataObj.category?.toLowerCase();
        currentDepartment = userDataObj.department;
      }

      let students = snapshot.docs.map(doc => {
        const data = doc.data();
        const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ");
        return {
          schoolID: doc.id,
          fullName,
          department: departmentMap[data.department] || data.department || "",
          originalDepartmentId: data.department,
          yearLevel: yearLevelMap[data.yearLevel] || data.yearLevel || "",
          yearLevelId: data.yearLevel || doc.id,
          email: data.institutionalEmail || data.gmail || "",
          clubs: Array.isArray(data.clubs) ? data.clubs.map(c => String(c).toLowerCase()) : [],
          semester: data.semester,
          violations: Array.isArray(data.violations) ? data.violations : [],
          officers: Array.isArray(data.officers) ? data.officers : [],
          incomplete: Array.isArray(data.incompletes) ? data.incompletes : []
        };
      });

      // Example Filtering per Office/Category
      if (currentCategory === "39" || currentCategory === "41") {
        students = students.filter(s => s.semester === currentSemesterId);
      } else if (["2","3","5","6","9","10","12"].includes(office)) {
        students = students.filter(s => s.semester === currentSemesterId);
      } else if (["4","7","11"].includes(office)) {
        students = students.filter(s => currentDepartment && s.originalDepartmentId === currentDepartment && s.semester === currentSemesterId);
      } else if (["16","15","14","13","8"].includes(office)) {
        if (!currentCategory) {
          students = [];
        } else {
          const membershipRef = db.collection("Membership").doc(currentCategory).collection("Members");
          const membershipSnapshot = await membershipRef.where("semester","==",currentSemesterId).get();
          const allowedIDs = membershipSnapshot.docs.map(doc => doc.id);
          students = students.filter(s => allowedIDs.includes(s.schoolID));
        }
      } else if (!isNaN(currentCategory) && Number(currentCategory) >= 1 && Number(currentCategory) <= 38) {
        students = students.filter(s => Array.isArray(s.clubs) && s.clubs.includes(currentCategory) && s.semester === currentSemesterId);
      } else {
        students = [];
      }

      // ✅ RENDER IMMEDIATELY - Show table without waiting for validation
      renderStudents(students);
      populateHeaderFilters(students);

      // ✅ THEN run validation in background in batches
      if (designeeID && typeof autoValidateRequirements === "function") {
        validateInBatches(students).catch(err => {
          console.error("Batch validation error:", err);
        });
      }

    } catch (err) {
      console.error(err);
      studentsTableBody.innerHTML = "<tr><td colspan='10'>Failed to load students.</td></tr>";
    }
  }

  // -------------------- Update Student Role --------------------
  async function updateStudentRole(studentID, role, checked) {
    if (!designeeID) {
      console.error("Designee ID not found for role update!");
      return;
    }
    const docRef = db.collection("User").doc("Students").collection("StudentsDocs").doc(studentID);
    try {
      const fieldName = role.toLowerCase() + (role.endsWith("s") ? "" : "s");
      if (checked) {
        await docRef.set({ [fieldName]: firebase.firestore.FieldValue.arrayUnion(designeeID) }, { merge: true });
      } else {
        await docRef.set({ [fieldName]: firebase.firestore.FieldValue.arrayRemove(designeeID) }, { merge: true });
      }
    } catch (err) {
      console.error(`Failed to update ${role} for ${studentID}`, err);
    }
  }

  // -------------------- Event Delegation --------------------
  studentsTableBody.addEventListener("click", async (e) => {
    const validateBtn = e.target.closest(".validate-button");
    if (validateBtn) {
      const studentID = validateBtn.getAttribute("data-studentid");
      if (typeof openRequirementsModal === "function") {
        await openRequirementsModal(studentID, designeeID, db, { autoRun: false });
      } else console.error("openRequirementsModal not found");
      return;
    }

    const viewBtn = e.target.closest(".view-button");
    if (viewBtn) {
      const studentID = viewBtn.getAttribute("data-studentid");
      if (typeof openViewClearanceCard === "function") openViewClearanceCard(studentID, db);
      else console.error("openViewClearanceCard not found");
      return;
    }

    const checkbox = e.target.closest(".role-checkbox");
    if (checkbox) {
      const studentID = checkbox.getAttribute("data-studentid");
      let role = "";
      if (checkbox.classList.contains("incomplete-checkbox")) role = "incomplete";
      else if (checkbox.classList.contains("violation-checkbox")) role = "violation";
      else if (checkbox.classList.contains("officer-checkbox")) role = "officer";
      await updateStudentRole(studentID, role, checkbox.checked);
    }
  });

  // -------------------- Initialize --------------------
  await loadMappings();
  await loadStudents();
  if (typeof loadUserRoleDisplay === "function") await loadUserRoleDisplay();

});