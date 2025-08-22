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

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', async () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const keysToRemove = [
        "userData", "studentName", "schoolID", "studentID",
        "staffID", "designeeID", "category", "office", "department"
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  } else {
    console.warn("logoutBtn not found");
  }

  // 🔽 Dropdown toggle
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

  // 🔍 Get local user data
  const userData = JSON.parse(localStorage.getItem('userData'));
  const userID = userData?.userID || userData?.id;

  if (!userData || !userID) {
    alert('Session expired or user not found. Please log in again.');
    window.location.href = '../../login/designee_login.html';
    return;
  }

  document.getElementById('headerUsername').textContent = userID;

  try {
    let profileData = userData;

    // 🔄 If staff, get full record
    if (userData.role === "staff") {
      const staffDoc = await db.collection("staffTable").doc(userID).get();
      if (!staffDoc.exists) {
        alert("Staff record not found.");
        return;
      }
      profileData = staffDoc.data();
    }

    // Display static fields
    document.getElementById('profileFirstName').textContent = profileData.firstName || profileData.firstname || 'N/A';
document.getElementById('profileLastName').textContent = profileData.lastName || profileData.lastname || 'N/A';

    document.getElementById('profileUserID').textContent = userID || 'N/A';
    document.getElementById('profileEmail').textContent =
      profileData.institutionalEmail || profileData.email || 'N/A';

    // 🔍 Convert and display office name
    if (profileData.office) {
      const officeSnap = await db.collection('officeTable').doc(profileData.office).get();
      if (officeSnap.exists) {
        document.getElementById('profileOffice').textContent = officeSnap.data().office || 'Unknown Office';
      } else {
        document.getElementById('profileOffice').textContent = 'Office not found';
      }
    }

    // 🔍 Convert and display department name
    if (profileData.department) {
      const deptSnap = await db.collection('departmentTable').doc(profileData.department).get();
      if (deptSnap.exists) {
        document.getElementById('profileDepartment').textContent = deptSnap.data().department || 'Unknown Department';
      } else {
        document.getElementById('profileDepartment').textContent = 'Department not found';
      }
    } else {
      document.getElementById('profileDepartment').textContent = 'N/A';
    }

    // 🔍 Convert and display category name
   // 🔍 Convert and display category name from acadClubTable or groupTable
if (profileData.category) {
  let categoryName = 'N/A';

  // Try acadClubTable first
  let catSnap = await db.collection('acadClubTable').doc(profileData.category).get();
  if (catSnap.exists) {
    categoryName = catSnap.data().club || 'Unnamed Club';
  } else {
    // Fallback to groupTable
    catSnap = await db.collection('groupTable').doc(profileData.category).get();
    if (catSnap.exists) {
      categoryName = catSnap.data().club || 'Unnamed Group';
    } else {
      categoryName = 'Category not found';
    }
  }

  document.getElementById('profileCategory').textContent = categoryName;
} else {
  document.getElementById('profileCategory').textContent = 'N/A';
}


  } catch (err) {
    console.error('Error loading profile:', err);
    document.getElementById('profileOffice').textContent = 'Error loading office';
    document.getElementById('profileDepartment').textContent = 'Error loading department';
    document.getElementById('profileCategory').textContent = 'Error loading category';
  }
});
