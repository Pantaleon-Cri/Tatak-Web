// clearanceLog.js
document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("schoolID");
  if (!studentId) return; // Already handled in clearance.js

  try {
    // ================= Fetch student =================
    const studentDoc = await db.collection("Students").doc(studentId).get();
    if (!studentDoc.exists) return;
    const student = studentDoc.data();

    const fullName = `${student.lastName || ""}, ${student.firstName || ""}`.trim();
    const semesterId = String(student.semester || "");
    let semesterName = "Unknown Semester";

    if (semesterId) {
      const semDoc = await db.collection("semesterTable").doc(semesterId).get();
      if (semDoc.exists) semesterName = semDoc.data().semester || semesterName;
    }

    // ================= Fetch validation data =================
    const valDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    const officesData = valDoc.exists ? valDoc.data().offices || {} : {};

    let allCleared = true;
    const clearanceMap = {};

    for (const officeKey in officesData) {
      const validations = officesData[officeKey];
      const allChecked = validations.length > 0 && validations.every(v => v.status === true);

      if (!allChecked) allCleared = false;

      const lastChecked = validations.filter(v => v.status === true).pop();
      clearanceMap[officeKey] = {
        status: allChecked ? "Cleared" : "Pending",
        approvedBy: lastChecked?.checkedBy || null
      };
    }

    // ================= Save / Update StudentsClearanceLog =================
    const logRef = db.collection("StudentsClearanceLog").doc(studentId);

    await logRef.set({
      schoolID: studentId,
      fullName: fullName || student.fullName || "",
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      semesters: {
        [semesterName]: {
          overallStatus: allCleared ? "Completed" : "Pending",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          clearances: clearanceMap
        }
      }
    }, { merge: true });

    console.log(`📌 Clearance log updated for ${studentId} in ${semesterName}`);
  } catch (err) {
    console.error("Error updating clearance log:", err);
  }
});
