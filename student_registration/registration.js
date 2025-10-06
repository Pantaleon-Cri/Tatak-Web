document.addEventListener('DOMContentLoaded', async () => {
  // Firebase configuration
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

  // DOM Elements
  const registrationForm = document.getElementById('registrationForm');
  const courseSelect = document.getElementById('course');
  const yearLevelSelect = document.getElementById('yearLevel');
  const semesterSelect = document.getElementById('semester');
  const departmentInput = document.getElementById('department');
  const clubsInput = document.getElementById('clubs');
  const messageBox = document.getElementById('messageBox');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  const courseDataMap = {};

  // -----------------------
  // Load current semester
  const semesterSnapshot = await db.collection("DataTable")
    .doc("Semester")
    .collection("SemesterDocs")
    .where("currentSemester", "==", true)
    .limit(1)
    .get();

  if (!semesterSnapshot.empty) {
    semesterSnapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = data.semester || doc.id;
      semesterSelect.appendChild(option);
    });
  } else {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No active semester";
    semesterSelect.appendChild(option);
  }

  // -----------------------
  // Load year levels
  const yearSnapshot = await db.collection("DataTable")
    .doc("YearLevel")
    .collection("YearLevelDocs")
    .get();
  yearSnapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = data.yearLevel || doc.id;
    yearLevelSelect.appendChild(option);
  });

  // -----------------------
  // Load Departments into a map
  // key = doc ID, value = {code: "human-readable code"}
  const departmentMap = {};
  const deptSnapshot = await db.collection("DataTable")
    .doc("Department")
    .collection("DepartmentDocs")
    .get();
  deptSnapshot.forEach(doc => {
    const data = doc.data();
    departmentMap[doc.id] = { code: data.code }; // human-readable code
  });

  // -----------------------
  // Load Clubs into a map
  // key = doc ID, value = {code: "human-readable code"}
  const clubsMap = {};
  const clubSnapshot = await db.collection("DataTable")
    .doc("Clubs")
    .collection("ClubsDocs")
    .get();
  clubSnapshot.forEach(doc => {
    const data = doc.data();
    clubsMap[doc.id] = { code: data.code }; // human-readable code
  });

  // -----------------------
  // Load Courses and map department & clubs
  const courseSnapshot = await db.collection("DataTable")
    .doc("Course")
    .collection("CourseDocs")
    .get();
  courseSnapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = data.course || doc.id; // readable course name
    courseSelect.appendChild(option);

    // Map department doc ID and club doc IDs array
    courseDataMap[doc.id] = {
      deptId: data.deptCodeName || '',            // department doc ID
      clubIds: Array.isArray(data.clubCodeName) ? data.clubCodeName : [] // array of club doc IDs
    };
  });

  // -----------------------
  // Auto-fill department and clubs when course is selected
  courseSelect.addEventListener('change', () => {
    const selected = courseSelect.value;
    const courseInfo = courseDataMap[selected];

    // Department name (from doc ID -> code)
    const dept = departmentMap[courseInfo?.deptId];
    departmentInput.value = dept ? dept.code : '';

    // Club names (from doc IDs -> codes)
    const clubNames = courseInfo?.clubIds.map(id => clubsMap[id]?.code).filter(Boolean);
    clubsInput.value = clubNames.length > 0 ? clubNames.join(', ') : '';
  });

  // -----------------------
  // Message display helper
  const showMessage = (message, isError = false) => {
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    messageBox.className = 'message-box mt-4 text-sm text-center font-medium';
    messageBox.classList.add(isError ? 'text-red-600' : 'text-green-600');
    setTimeout(() => { messageBox.style.display = 'none'; }, 4000);
  };

  // Password validation
  const isPasswordValid = (password) => {
    const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    return regex.test(password);
  };

  // -----------------------
  // Form submission
  registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const schoolId = document.getElementById('schoolId').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const course = courseSelect.value;
    const yearLevel = yearLevelSelect.value;
    const semester = semesterSelect.value;
    const institutionalEmail = document.getElementById('institutionalEmail').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    const courseInfo = courseDataMap[course];
    const deptId = courseInfo?.deptId || '';
    const clubIds = courseInfo?.clubIds || [];

    // -----------------------
    // Validation
    if (!schoolId || !firstName || !lastName || !course || !yearLevel || !semester || !institutionalEmail || !password || !confirmPassword) {
      showMessage("Please fill in all required fields.", true);
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.", true);
      passwordInput.value = '';
      confirmPasswordInput.value = '';
      passwordInput.focus();
      return;
    }

    if (!isPasswordValid(password)) {
      showMessage("Password must be at least 8 characters, include uppercase, number, special char.", true);
      passwordInput.value = '';
      confirmPasswordInput.value = '';
      passwordInput.focus();
      return;
    }

    try {
      // Check if student already exists
      const existing = await db.collection("User")
        .doc("Students")
        .collection("StudentsDocs")
        .doc(schoolId)
        .get();
      if (existing.exists) {
        showMessage("This School ID is already registered.", true);
        return;
      }

      // -----------------------
      // Save student data
      const studentData = {
        schoolId,
        firstName,
        lastName,
        course,       // course doc ID
        yearLevel,
        semester,
        department: deptId, // department doc ID
        clubs: clubIds,     // array of club doc IDs
        institutionalEmail,
        password,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("User")
        .doc("Students")
        .collection("StudentsDocs")
        .doc(schoolId)
        .set(studentData);

      showMessage("Registration successful! Redirecting...");
      setTimeout(() => { window.location.href = "../login/student_login.html"; }, 1500);

    } catch (error) {
      console.error("Error saving student:", error);
      showMessage("Failed to register. Please try again.", true);
    }
  });
});
