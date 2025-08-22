// Initialize Firebase v8 (if not already initialized)
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
    authDomain: "tatak-mobile-web.firebaseapp.com",
    projectId: "tatak-mobile-web",
    storageBucket: "tatak-mobile-web.appspot.com",
    messagingSenderId: "771908675869",
    appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
    measurementId: "G-CENPP29LKQ"
  });
}
const db = firebase.firestore();

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", async () => {
  const dropdownToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  // Toggle dropdown on click
  dropdownToggle.addEventListener("click", () => {
    dropdownMenu.style.display = 
      dropdownMenu.style.display === "block" ? "none" : "block";
  });

  // Hide dropdown if clicked outside
  document.addEventListener("click", (event) => {
    if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
      dropdownMenu.style.display = "none";
    }
  });

  const tbody = document.querySelector(".log-table tbody");
  if (!tbody) return console.error("Table body not found");

  try {
    // Fetch all staff
    const staffSnap = await db.collection("staffTable").get();
    const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch lookup tables
    const [clubsSnap, groupsSnap, departmentsSnap, officesSnap] = await Promise.all([
      db.collection("acadClubTable").get(),
      db.collection("groupTable").get(),
      db.collection("departmentTable").get(),
      db.collection("officeTable").get()
    ]);

    // Create lookup maps
    const clubsMap = {};
    clubsSnap.forEach(doc => {
      const data = doc.data();
      clubsMap[doc.id] = data.codeName || "";
    });

    const groupsMap = {};
    groupsSnap.forEach(doc => {
      const data = doc.data();
      groupsMap[doc.id] = data.club || "";
    });

    const departmentsMap = {};
    departmentsSnap.forEach(doc => {
      const data = doc.data();
      departmentsMap[doc.id] = data.department || "";
    });

    const officesMap = {};
    officesSnap.forEach(doc => {
      const data = doc.data();
      officesMap[doc.id] = data.office || "";
    });

    // Render staff
    tbody.innerHTML = ""; // clear existing rows
    staffList.forEach(staff => {
      let categoryName = "";
      if (staff.category) {
        categoryName = clubsMap[staff.category] || groupsMap[staff.category] || staff.category;
      }

      const deptName = departmentsMap[staff.department] || staff.department || "";
      const officeName = officesMap[staff.office] || staff.office || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${staff.id || ""}</td>
        <td>${staff.firstName || ""}</td>
        <td>${staff.lastName || ""}</td>
        <td>${officeName}</td>
        <td>${deptName || 'N/A'} </td>
         <td>${categoryName || 'N/A'}</td>
        <td>${staff.email || ""}</td>
        <td>
          <button class="action-btn edit" data-id="${staff.id}"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete" data-id="${staff.id}"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error loading staff:", error);
  }
});

// Sidebar submenu toggle
function initSidebarDropdowns() {
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      const parentLi = this.parentElement;
      const submenu = parentLi.querySelector('.submenu');
      if (submenu.style.display === 'block') {
        submenu.style.display = 'none';
        this.querySelector('.arrow')?.classList.remove('rotated');
      } else {
        submenu.style.display = 'block';
        this.querySelector('.arrow')?.classList.add('rotated');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initSidebarDropdowns);
