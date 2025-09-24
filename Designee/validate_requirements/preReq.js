async function getStudentPrereqs(studentData, currentDesignee) {
  const prereqChecks = [];

  // --- Helper: Check if all requirements in an office are cleared ---
  async function isOfficeReqCleared(studentID, officeKey) {
    try {
      const officeDoc = await db.collection("ValidateRequirementsTable").doc(studentID).get();
      if (!officeDoc.exists) return false;

      const data = officeDoc.data();
      if (!data.offices || !data.offices[officeKey]) return false;

      const officeArray = data.offices[officeKey];
      if (!Array.isArray(officeArray) || officeArray.length === 0) return false;

      const studentDoc = await db.collection("Students").doc(studentID).get();
      const currentSemester = studentDoc.exists ? String(studentDoc.data().semester || "").trim() : null;

      let filteredReqs = currentSemester
        ? officeArray.filter(req => String(req.semester || "").trim() === currentSemester)
        : [];

      if (filteredReqs.length === 0) {
        filteredReqs = officeArray.filter(req => req.status === true);
      }

      if (filteredReqs.length === 0) return false;
      return filteredReqs.every(req => req.status === true);
    } catch (err) {
      console.error("Error checking office requirements:", err);
      return false;
    }
  }

  // --- Helper: Get lab display names ---
  async function getLabName(labId) {
    try {
      const doc = await db.collection("labTable").doc(labId).get();
      return doc.exists ? doc.data().lab || labId : labId;
    } catch (err) {
      console.error(`Error fetching lab name for ${labId}:`, err);
      return labId;
    }
  }

  // --- Helper: Get club display names ---
  async function getClubName(clubId) {
    try {
      const snap = await db.collection("acadClubTable").where("id", "==", clubId).limit(1).get();
      return !snap.empty ? snap.docs[0].data().codeName || clubId : clubId;
    } catch (err) {
      console.error(`Error fetching club name for ${clubId}:`, err);
      return clubId;
    }
  }

  // --- 1️⃣ DSA / NSTP (Office 305) ---
  if (currentDesignee.office === "305") {
    try {
      const ssgSnapshot = await db.collection("Designees").where("category", "==", "401").limit(1).get();
      let cleared = false;
      if (!ssgSnapshot.empty) {
        const ssgUserID = ssgSnapshot.docs[0].data().userID?.trim();
        cleared = ssgUserID ? await isOfficeReqCleared(studentData.schoolID, ssgUserID) : false;
      }
      prereqChecks.push({ name: "SSG", cleared });
    } catch (err) {
      console.error("Error fetching SSG prerequisite:", err);
      prereqChecks.push({ name: "SSG", cleared: false });
    }

    try {
      const departmentCouncilMap = { "01": "1018", "02": "1011", "03": "1028", "04": "1036", "05": "101" };
      const studentDept = String(studentData.department || "").trim();
      const councilCategory = departmentCouncilMap[studentDept];

      let cleared = false;
      if (councilCategory) {
        const councilSnapshot = await db.collection("Designees").where("category", "==", councilCategory).limit(1).get();
        if (!councilSnapshot.empty) {
          const councilUserID = councilSnapshot.docs[0].data().userID?.trim();
          cleared = councilUserID ? await isOfficeReqCleared(studentData.schoolID, councilUserID) : false;
        }
      }
      prereqChecks.push({ name: "Council", cleared });
    } catch (err) {
      console.error("Error fetching Council prerequisite:", err);
      prereqChecks.push({ name: "Council", cleared: false });
    }
  }

  // --- 2️⃣ Dean Offices (Office 308) ---
  if (currentDesignee.office === "308") {
    const dept = currentDesignee.department;
    let councilCategory;
    let includeProgramCoordinator = false;

    if (dept === "04") councilCategory = "1036";
    else if (dept === "05") councilCategory = "101";
    else if (dept === "02") { councilCategory = "1011"; includeProgramCoordinator = true; }
    else if (dept === "03") { councilCategory = "1028"; includeProgramCoordinator = true; }

    // Program Coordinator
    if (includeProgramCoordinator) {
      try {
        const progSnap = await db.collection("Designees").where("office", "==", "317").limit(1).get();
        let cleared = false;
        if (!progSnap.empty) {
          const progUserID = progSnap.docs[0].data().userID?.trim();
          cleared = progUserID ? await isOfficeReqCleared(studentData.schoolID, progUserID) : false;
        }
        prereqChecks.push({ name: "Program Coordinator", cleared });
      } catch (err) {
        console.error("Error fetching Program Coordinator:", err);
        prereqChecks.push({ name: "Program Coordinator", cleared: false });
      }
    }

    // --- Labs ---
    try {
      const labCategories = [];
      const labStatusMap = {};
      const labNamesMap = {};
      const validLabIds = ["201", "202", "203", "204", "205"]; // Only these labs

      const labTablesSnap = await db.collection("labTable").get();
      const allLabs = {};
      labTablesSnap.forEach(doc => {
        const data = doc.data();
        if (data && data.lab) allLabs[doc.id] = data.lab;
      });

      // Membership for valid labs only
      for (const labId of validLabIds) {
        const memberDoc = await db.collection("Membership").doc(labId).collection("Members").doc(studentData.schoolID).get();
        if (memberDoc.exists) {
          labCategories.push(labId);
          labNamesMap[labId] = allLabs[labId] || labId;
          labStatusMap[labId] = false;
        }
      }

      // Check if cleared
      for (const labId of labCategories) {
        const labSnapshot = await db.collection("Designees").where("category", "==", labId).limit(1).get();
        let cleared = false;
        if (!labSnapshot.empty) {
          const labUserID = labSnapshot.docs[0].data().userID?.trim();
          cleared = labUserID ? await isOfficeReqCleared(studentData.schoolID, labUserID) : false;
        }
        labStatusMap[labId] = cleared;
      }

      const allLabsCleared = Object.values(labStatusMap).every(val => val === true);
      prereqChecks.push({
        name: labCategories.length > 0 ? labCategories.map(id => labNamesMap[id]).join(", ") : "No Lab",
        cleared: allLabsCleared
      });

    } catch (err) {
      console.error("Error fetching labs for Dean:", err);
      prereqChecks.push({ name: "Lab", cleared: false });
    }

    // Council
    try {
      const councilSnap = await db.collection("Designees").where("category", "==", councilCategory).limit(1).get();
      let cleared = false;
      if (!councilSnap.empty) {
        const councilUserID = councilSnap.docs[0].data().userID?.trim();
        cleared = councilUserID ? await isOfficeReqCleared(studentData.schoolID, councilUserID) : false;
      }
      prereqChecks.push({ name: "Council", cleared });
    } catch (err) {
      console.error("Error fetching Council prerequisite:", err);
      prereqChecks.push({ name: "Council", cleared: false });
    }
  }

  // --- 3️⃣ Office 316 Special Prerequisites ---
  if (currentDesignee.office === "316") {
    const studentDoc = await db.collection("Students").doc(studentData.schoolID).get();
    const studentDept = studentDoc.exists ? String(studentDoc.data().department || "").trim() : null;

    const officeList = [];
    if (studentDept) officeList.push(`307${studentDept}`);
    if (studentDept) officeList.push(`308${studentDept}`);
    officeList.push("305", "306", "304", "303", "302");

    for (const officeKey of officeList) {
      try {
        let cleared = false;
        let userID = null;

        if (officeKey.startsWith("308") || officeKey.startsWith("307")) {
          const officeNum = officeKey.slice(0, 3);
          const deptCode = officeKey.slice(3);
          const desSnap = await db.collection("Designees").where("office", "==", officeNum).where("department", "==", deptCode).limit(1).get();
          if (!desSnap.empty) userID = desSnap.docs[0].data().userID?.trim();
        } else {
          const desSnap = await db.collection("Designees").where("office", "==", officeKey).limit(1).get();
          if (!desSnap.empty) userID = desSnap.docs[0].data().userID?.trim();
        }

        cleared = userID ? await isOfficeReqCleared(studentData.schoolID, userID) : false;
        prereqChecks.push({ name: officeKey, cleared });
      } catch (err) {
        console.error(`Error fetching prerequisite for office ${officeKey}:`, err);
        prereqChecks.push({ name: officeKey, cleared: false });
      }
    }
  }

  // --- 4️⃣ Council Category Club Prerequisites ---
  const councilCategories = ["101", "1011", "1018", "1028", "1036"];
  if (councilCategories.includes(currentDesignee.category)) {
    try {
      const studentDoc = await db.collection("Students").doc(studentData.schoolID).get();
      const clubs = studentDoc.exists ? studentDoc.data().clubs || [] : [];

      const filteredClubs = clubs.filter(club => !councilCategories.includes(club));
      for (const clubId of filteredClubs) {
        try {
          let cleared = false;
          const desSnap = await db.collection("Designees").where("category", "==", clubId).limit(1).get();
          if (!desSnap.empty) {
            const userID = desSnap.docs[0].data().userID?.trim();
            cleared = userID ? await isOfficeReqCleared(studentData.schoolID, userID) : false;
          }
          const clubName = await getClubName(clubId);
          prereqChecks.push({ name: clubName, cleared });
        } catch (err) {
          console.error(`Error fetching club prerequisite for ${clubId}:`, err);
          prereqChecks.push({ name: clubId, cleared: false });
        }
      }
    } catch (err) {
      console.error("Error fetching student's clubs for council prerequisite:", err);
    }
  }

  // --- Return HTML ---
  return prereqChecks.map(pr => `<span style="color:${pr.cleared ? "green" : "red"}">${pr.name}</span>`).join(", ");
}
