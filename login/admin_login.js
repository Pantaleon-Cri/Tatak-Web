document.getElementById("registrationForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const adminID = document.getElementById("adminID").value.trim();
  const password = document.getElementById("password").value.trim();
  const messageBox = document.getElementById("messageBox");

  messageBox.style.display = "none";
  messageBox.textContent = "";

  console.log("Input Admin ID:", adminID);
  console.log("Input Password:", password);

  try {
    const docRef = db.collection("adminAccount").doc(adminID);  // ✅ Corrected this line
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      console.log("Firestore Data:", data);

      if (data.password === password) {
        messageBox.style.display = "block";
        messageBox.style.color = "green";
        messageBox.textContent = "Login successful!";
        setTimeout(() => {
          window.location.href = "../admin/admin.html"; // ✅ Change path if needed
        }, 1000);
      } else {
        messageBox.style.display = "block";
        messageBox.style.color = "red";
        messageBox.textContent = "Incorrect password.";
      }
    } else {
      messageBox.style.display = "block";
      messageBox.style.color = "red";
      messageBox.textContent = "Admin ID not found.";
    }
  } catch (error) {
    console.error("Login error:", error);
    messageBox.style.display = "block";
    messageBox.style.color = "red";
    messageBox.textContent = "Something went wrong. Try again.";
  }
});
