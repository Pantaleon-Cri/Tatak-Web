// 🔥 Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

// ✅ Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', async () => {
  // 🔽 User dropdown toggle
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  // 🔐 Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const keysToRemove = [
        "userData", "studentName", "schoolID", "studentID",
        "staffID", "designeeID", "category", "office", "department"
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = "../../logout.html";
    });
  }

  // 📄 Load student profile
  const studentId = localStorage.getItem('schoolID');
  if (!studentId) {
    alert('Session expired. Please log in again.');
    window.location.href = '../../login/student_login.html';
    return;
  }

  try {
    const doc = await db.collection('/User/Students/StudentsDocs').doc(studentId).get();
    if (!doc.exists) {
      alert('Student record not found.');
      return;
    }

    const student = doc.data();

    // 🧾 Basic info
    document.getElementById('profileUserID').textContent = student.schoolId || 'N/A';
    document.getElementById('profileFullName').textContent = `${student.firstName} ${student.lastName}` || 'N/A';
    document.getElementById('profileEmail').textContent = student.institutionalEmail || 'N/A';
    document.getElementById('profileYearLevel').textContent = student.yearLevel || 'N/A';
   // 🎓 Year Level from YearLevelDocs
    let yearLevelName = student.yearLevel || 'N/A';
    if (student.yearLevel) {
      const yearDoc = await db.collection('/DataTable/YearLevel/YearLevelDocs').doc(student.yearLevel).get();
      if (yearDoc.exists) {
        yearLevelName = yearDoc.data().yearLevel || student.yearLevel;
      }
    }
    document.getElementById('profileYearLevel').textContent = yearLevelName;
    // 🎓 Course Name
    let courseName = student.course;
    if (student.course) {
      const courseDoc = await db.collection('/DataTable/Course/CourseDocs').doc(student.course).get();
      if (courseDoc.exists) {
        courseName = courseDoc.data().course || student.course;
      }
    }
    document.getElementById('profileCourse').textContent = courseName;

    // 🏛 Department Name
    let departmentName = student.department;
    if (student.department) {
      const deptDoc = await db.collection('/DataTable/Department/DepartmentDocs').doc(student.department).get();
      if (deptDoc.exists) {
        departmentName = deptDoc.data().department || student.department;
      }
    }
    document.getElementById('profileDepartment').textContent = departmentName;

 
    // 🎯 Clubs (Support multiple club IDs stored as array)
    let clubNames = "N/A";
    if (Array.isArray(student.clubs)) {
      const clubNamesArr = [];
      for (const clubId of student.clubs) {
        const clubDoc = await db.collection('/DataTable/Clubs/ClubsDocs').doc(clubId).get();
        if (clubDoc.exists) {
          clubNamesArr.push(clubDoc.data().code);
        }
      }
      clubNames = clubNamesArr.length ? clubNamesArr.join(", ") : "N/A";
    }
    document.getElementById('profileClubs').textContent = clubNames;

    // 🧑 Set top dropdown label
    const firstName = student.firstName || "";
const lastName = student.lastName || "";
const fullName = `${firstName} ${lastName}`.trim();

    document.getElementById('headerUsername').textContent = fullName;

  } catch (error) {
    console.error('Error fetching student profile:', error);
    alert('Error loading profile. Please try again.');
  }
});
