const arUniqueNamesFromInput = [];
const arIdsForOutput = [];
const arNoMatches = [];
let arSkippedGames = [];
const BASE_URL = "https://boardgamegeek.com/xmlapi2/";
const sectionInput = document.querySelector("#input");
const sectionProcessing = document.querySelector("#processing");
const modalTooManyRequests = document.querySelector("#modal-background");
const countdown = document.querySelector("#countdown-till-retry");
const sectionResults = document.querySelector("#results");
const tileContainer = document.querySelector("#tile-container");
const headingChooseGame = document.querySelector("#heading-choose-game");
let i = 0;

document.querySelectorAll(".skip-to-end").forEach((btn) => {
  btn.addEventListener("click", () => {
    arSkippedGames = arUniqueNamesFromInput.slice(i);
    announceResults();
  });
});

async function fetchData(url) {
  modalTooManyRequests.classList.add("hidden");
  try {
    const response = await fetch(url);
    const responseText = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(responseText, "text/xml");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      modalTooManyRequests.classList.remove("hidden");
      startTimer(30, countdown);
      await new Promise((resolve) => setTimeout(resolve, 30000));
      return await fetchData(url);
    }
    console.error(`fetchData failed. ${error}`);
    throw error;
  }
}

function startTimer(duration, display) {
  const intervalId = setInterval(() => {
    let minutes = parseInt(duration / 60, 10);
    let seconds = parseInt(duration % 60, 10);

    minutes = minutes < 10 ? `0${minutes}` : minutes;
    seconds = seconds < 10 ? `0${seconds}` : seconds;

    display.textContent = `${minutes}:${seconds}`;
    --duration;
    if (duration < 0) clearInterval(intervalId);
  }, 1000);
}
document.querySelector("#start").addEventListener("click", () => {
  const inputFromTextarea = document.querySelector("textarea").value;

  //   const uploadedFile = document.querySelector("input[type='file'");
  const arAllNamesFromInput = inputFromTextarea
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g) // Split at Commas which are not between quotes (see https://stackoverflow.com/a/53774647)
    .map(
      (name) =>
        name
          .replace(/^ */g, "") // Remove spaces at the beginning...
          .replace(/ *$/g, "") // ... and at the end...
          .replace(/"/g, "") // ... as well as quotes...
          .replace(/\\n/g, "") // ... and other symbols that would compromise the search and comparision
    );
  // Remove duplicates and empty strings
  arAllNamesFromInput.forEach((name) => {
    if (!arUniqueNamesFromInput.includes(name) && name) {
      arUniqueNamesFromInput.push(name);
    }
  });
  sectionInput.classList.add("hidden");
  sectionProcessing.classList.remove("hidden");
  arUniqueNamesFromInput.forEach((name) => {
    const rowInProgressSidebar = document.createElement("tr");
    rowInProgressSidebar.innerHTML = `<td class="name">${name}</td><td class="status"></td>`;
    document.querySelector("#progress-table").appendChild(rowInProgressSidebar);
  });

  processNextGame();
});

async function processNextGame() {
  if (i === arUniqueNamesFromInput.length) {
    announceResults();
    return;
  }
  const searchTerm = arUniqueNamesFromInput[i];
  const arMatchesIds = [];
  const xmlSearchResult = await fetchData(
    `${BASE_URL}search?query=${searchTerm}&type=boardgame`
  );

  if (xmlSearchResult === "error") return;

  const arSearchResultItems = xmlSearchResult.querySelectorAll(
    "item[type='boardgame']"
  );

  if (arSearchResultItems.length === 0) {
    processResult(null, searchTerm, "No search results");
    return;
  }

  for (let j = 0; j < arSearchResultItems.length; j++) {
    const nameSearchResult = arSearchResultItems[j]
      .querySelector("name")
      .getAttribute("value");
    const idSearchResult = arSearchResultItems[j].id;

    if (nameSearchResult === searchTerm) {
      arMatchesIds.push(idSearchResult);
    }
  }
  if (arMatchesIds.length === 0) {
    const arIds = Array.from(arSearchResultItems).map((result) => result.id);
    askForClarification(arIds, searchTerm);
  } else if (arMatchesIds.length === 1) {
    processResult(arMatchesIds[0], searchTerm);
  } else {
    askForClarification(arMatchesIds, searchTerm);
  }
}

async function askForClarification(arIds, searchTerm) {
  if (arIds.length > 75) {
    processResult(null, searchTerm, "Too many search results");
    return;
  }
  const xmlSearchResults = await fetchData(
    `${BASE_URL}thing?id=${arIds.join(",")}&type=boardgame`
  );
  const arNodesSearchResults = xmlSearchResults.querySelectorAll(
    "item[type='boardgame']"
  );

  if (arNodesSearchResults.length === 0) {
    processResult(null, searchTerm, "No search results");
    return;
  }

  arNodesSearchResults.forEach((result) => {
    const tile = document.createElement("div");
    tile.classList.add("tile");
    const thumbnail = result.querySelector("thumbnail")
      ? result.querySelector("thumbnail").textContent
      : "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";
    const year = result.querySelector("yearpublished").getAttribute("value");
    const link = `<a href="https://boardgamegeek.com/boardgame/${result.id}" target="_blank">BGG&nbsp;&neArr;</a>`;
    const primaryName = result
      .querySelector("name[type='primary']")
      .getAttribute("value");

    // To make the name comparision case-insensitive
    const regexSearchTerm = new RegExp(searchTerm, "i");
    const arAlternateNames = !primaryName.match(regexSearchTerm)
      ? Array.from(result.querySelectorAll("name[type='alternate']"))
          .map((node) => node.getAttribute("value").replace(/^|$/g, "&quot;"))
          .filter((name) => name.match(regexSearchTerm))
      : [];

    tile.innerHTML = `<img data-game-id="${result.id}" src="${thumbnail}" />\
          <p><strong>${primaryName}</strong> (${year},&nbsp;${link})</p>\
            ${
              arAlternateNames.length > 0
                ? `<p>(${arAlternateNames.join(", ")})</p>`
                : ""
            }
          `;
    tile.querySelector("img").addEventListener("click", (e) => {
      headingChooseGame.classList.add("hidden");
      tileContainer.innerHTML = "";
      processResult(e.target.getAttribute("data-game-id"), searchTerm);
    });
    tileContainer.appendChild(tile);
  });

  document.querySelector("#search-term-in-heading").textContent = searchTerm;
  headingChooseGame.classList.remove("hidden");
  const btnChooseNone = document.createElement("button");
  btnChooseNone.textContent =
    "None of these games is the right one / I'm not sure";
  btnChooseNone.addEventListener("click", () => {
    headingChooseGame.classList.add("hidden");
    tileContainer.innerHTML = "";
    processResult(
      null,
      searchTerm,
      "Search results didn't include the right game"
    );
  });
  tileContainer.insertBefore(
    btnChooseNone,
    tileContainer.querySelector(".tile")
  );
}

function processResult(id, searchTerm, status = `ID: ${id}`) {
  const statusInTable = document.querySelectorAll("#progress-table .status")[i];
  if (id) arIdsForOutput.push(id);
  else arNoMatches.push(searchTerm);
  statusInTable.textContent += status;
  statusInTable.style.color = id ? "green" : "red";
  ++i;
  setTimeout(processNextGame, 750);
}

function announceResults() {
  sectionProcessing.classList.add("hidden");
  sectionResults.classList.remove("hidden");
  if (arIdsForOutput.length > 0) {
    document.querySelector("#paragraph-id-list").classList.remove("hidden");
    document.querySelector("#id-list").textContent = arIdsForOutput.join(", ");
  }

  if (arSkippedGames.length > 0) {
    document.querySelector("#paragraph-skipped").classList.remove("hidden");
    document.querySelector("#skipped").textContent = arSkippedGames.join(", ");
  }
  if (arNoMatches.length > 0) {
    document.querySelector("#paragraph-no-matches").classList.remove("hidden");
    document.querySelector("#no-matches").textContent = arNoMatches.join(", ");
  }

  document.querySelector("#results").classList.remove("hidden");
}
