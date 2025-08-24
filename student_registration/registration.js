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

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // DOM Elements
  const registrationForm = document.getElementById('registrationForm');
  const courseSelect = document.getElementById('course');
  const yearLevelSelect = document.getElementById('yearLevel');
  const semesterSelect = document.getElementById('semester'); // ✅ Added
  const departmentInput = document.getElementById('department');
  const clubsInput = document.getElementById('clubs');
  const messageBox = document.getElementById('messageBox');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  // Store course metadata by ID
  const courseDataMap = {};

  // Load semesters visible to students
  const semesterSnapshot = await db.collection("semesterTable")
    .where("visibleToStudents", "==", true)
    .get();

  semesterSnapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = data.semester || doc.id;
    semesterSelect.appendChild(option);
  });

  // Load courses
  const courseSnapshot = await db.collection("courseTable").get();
  courseSnapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = data.course;
    courseSelect.appendChild(option);
    courseDataMap[doc.id] = {
      deptCodeName: data.deptCodeName || '',
      clubCodeName: data.clubCodeName || '',
    };
  });

  // Load year levels
  const yearSnapshot = await db.collection("yearLevelTable").get();
  yearSnapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = data.yearLevel;
    option.textContent = data.yearLevel;
    yearLevelSelect.appendChild(option);
  });

  // Auto-fill department and clubs
  courseSelect.addEventListener('change', () => {
    const selected = courseSelect.value;
    const courseInfo = courseDataMap[selected];
    if (courseInfo) {
      departmentInput.value = courseInfo.deptCodeName;
      clubsInput.value = courseInfo.clubCodeName;
    } else {
      departmentInput.value = '';
      clubsInput.value = '';
    }
  });

  // Message display
  const showMessage = (message, isError = false) => {
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    messageBox.className = 'message-box mt-4 text-sm text-center font-medium';
    messageBox.classList.add(isError ? 'text-red-600' : 'text-green-600');
    setTimeout(() => {
      messageBox.style.display = 'none';
    }, 4000);
  };

  // Form Submit
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
    const deptCodeName = courseInfo?.deptCodeName || '';
    const clubCodeName = courseInfo?.clubCodeName || '';

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

    try {
      // Check if schoolId already exists
      const studentDoc = await db.collection("Students").doc(schoolId).get();
      if (studentDoc.exists) {
        showMessage("This School ID is already registered.", true);
        return;
      }

      // Get department ID
      const deptSnap = await db.collection("departmentTable").where("code", "==", deptCodeName).limit(1).get();
      const department = deptSnap.empty ? "N/A" : deptSnap.docs[0].id;

      // Get club ID(s)
      let clubs = [];
      if (clubCodeName.includes(',')) {
        const clubCodeList = clubCodeName.split(',').map(name => name.trim());
        for (const code of clubCodeList) {
          const snap = await db.collection("acadClubTable").where("codeName", "==", code).limit(1).get();
          if (!snap.empty) clubs.push(snap.docs[0].id);
        }
      } else if (clubCodeName.trim() !== "") {
        const singleSnap = await db.collection("acadClubTable").where("codeName", "==", clubCodeName.trim()).limit(1).get();
        if (!singleSnap.empty) clubs.push(singleSnap.docs[0].id);
      }

      // Prepare data
      const studentData = {
        schoolId,
        firstName,
        lastName,
        course,
        yearLevel,
        semester,
        department,
        clubs,
        institutionalEmail,
        password,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Save to Firestore
      await db.collection("Students").doc(schoolId).set(studentData);
      showMessage("Registration successful! Redirecting...");

      setTimeout(() => {
        window.location.href = "../login/student_login.html";
      }, 1500);

    } catch (error) {
      console.error("Error saving data:", error);
      showMessage("Failed to register. Please try again.", true);
    }
  });
});
