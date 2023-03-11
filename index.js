let arNamesToBeProcessed = [];
const arFoundIds = [];
const arGamesWithNoIdFound = [];
let arSkippedGames = [];
let isIncludeExpansions = false;
const BASE_URL = "https://boardgamegeek.com";
const modalTooManyRequests = document.querySelector("#modal-background");
const countdown = document.querySelector("#countdown-till-retry");
const tileContainer = document.querySelector("#tile-container");
const headingChooseGame = document.querySelector("#heading-choose-game");
let i = 0;

// There are to skip buttons, one above the progress table and one in the "Too many requests" modal
document.querySelectorAll(".skip-to-end").forEach((btn) => {
  btn.addEventListener("click", () => {
    // i tells us how far we got, everything after it was skipped
    arSkippedGames = arNamesToBeProcessed.slice(i);
    announceFinalResults();
  });
});

function hideOldAndShowNextSection(hideThis, showThis) {
  document.querySelectorAll(`.visible-at-${hideThis}`).forEach((element) => {
    element.classList.add("hidden");
  });
  document.querySelectorAll(`.visible-at-${showThis}`).forEach((element) => {
    element.classList.remove("hidden");
  });
}

async function makeHttpRequest(url) {
  modalTooManyRequests.classList.add("hidden");
  try {
    const response = await fetch(url);
    const responseText = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(responseText, "text/xml");
  } catch (error) {
    // This represents a 429 "Too many requests"
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      modalTooManyRequests.classList.remove("hidden");
      startTimer(30, countdown);
      await new Promise((resolve) => setTimeout(resolve, 30000));
      return await makeHttpRequest(url);
    }
    console.error(`Http request failed. ${error}`);
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
  hideOldAndShowNextSection("input", "processing");
  isIncludeExpansions = document.querySelector("#includeExpansions").checked;
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

  // Remove empty strings and duplicates
  arNamesToBeProcessed = [...new Set(arAllNamesFromInput.filter(Boolean))];

  // Fill progress table with game names
  arNamesToBeProcessed.forEach((name) => {
    const NewRowInTable = document.createElement("tr");
    NewRowInTable.innerHTML = `<td class="name">${name}</td><td class="status"></td>`;
    document.querySelector("#progress-table").appendChild(NewRowInTable);
  });
  processNextGame();
});

async function processNextGame() {
  if (i === arNamesToBeProcessed.length) {
    announceFinalResults();
    return;
  }
  const searchTerm = arNamesToBeProcessed[i];

  const parameters = {
    query: searchTerm,
  };
  if (isIncludeExpansions) parameters.type = "boardgame,boardgameexpansion";
  // This is not enough to exclude expansions, but filters out some of them
  else parameters.type = "boardgame";

  const urlParameters = new URLSearchParams(parameters).toString();
  const xmlOfSearchByTerm = await makeHttpRequest(
    `${BASE_URL}/xmlapi2/search?${urlParameters}`
  ); // There are 3 possible outcomes of this search

  const arItemsOfSearchByTerm = xmlOfSearchByTerm.querySelectorAll("item");
  // 1. There aren't any search results at all (e. g. spelling mistake)
  if (arItemsOfSearchByTerm.length === 0) {
    processResult(null, searchTerm, "No search results");
    return;
  }

  // 2. There is exactly one search result. Is very likely that this is the right game, so we just take it
  if (arItemsOfSearchByTerm.length === 1) {
    processResult(arItemsOfSearchByTerm[0].id, searchTerm);
    return;
  }

  // 3. There is more than one search result
  // Now, we look for perfect matches (ignoring case), which again has 3 possible outcomes
  let arIdsOfMatches = Array.from(arItemsOfSearchByTerm)
    .filter(
      (item) =>
        item.querySelector("name").getAttribute("value").toLowerCase() ===
        searchTerm.toLowerCase()
    )
    .map((item) => item.id);

  // Remove duplicates which BGG sometimes shows in the search results for some reason
  arIdsOfMatches = [...new Set(arIdsOfMatches)];

  // 3.1. There is no perfect match
  if (arIdsOfMatches.length === 0) {
    let arIdsOfAllSearchResults = Array.from(arItemsOfSearchByTerm).map(
      (result) => result.id
    );
    // Remove duplicates
    arIdsOfAllSearchResults = [...new Set(arIdsOfAllSearchResults)];
    askForClarification(arIdsOfAllSearchResults, searchTerm);
  }
  // 3.2. There is exactly 1 perfect match
  else if (arIdsOfMatches.length === 1)
    processResult(arIdsOfMatches[0], searchTerm);
  // 3.3. There are many perfect matches
  else askForClarification(arIdsOfMatches, searchTerm);
}

// Get more data about all potential matches and display them so that the user can choose the right match
async function askForClarification(arIds, searchTerm) {
  // Don't request very long ID lists to avoid delays and 429 errors (and to spare the BGG servers)
  if (arIds.length > 75) {
    processResult(null, searchTerm, "Too many search results");
    return;
  }
  const parameters = {
    id: arIds.join(","),
  };
  if (isIncludeExpansions) parameters.type = "boardgame,boardgameexpansion";
  // This is filters out all expansions
  else {
    parameters.type = "boardgame";
    parameters.excludesubtype = "boardgameexpansion";
  }
  const urlParameters = new URLSearchParams(parameters).toString();
  const xmlOfRequestByIdList = await makeHttpRequest(
    `${BASE_URL}/xmlapi2/thing?${urlParameters}`
  );
  const arItemsOfRequestByIdList = Array.from(
    xmlOfRequestByIdList.querySelectorAll("item")
  );

  if (arItemsOfRequestByIdList.length === 0) {
    processResult(null, searchTerm, "No search results");
    return;
  }

  // Setup the page to page so that the user can choose the right game
  document.querySelector("#search-term-in-heading").textContent = searchTerm;
  headingChooseGame.classList.remove("hidden");

  // Alternatively to creating the btnChooseNone every time, it could also be hardcoded into the HTML file
  // However, the button could then not be in the same div as the tiles, because the tileContainer.innerHTML is emptied each time
  // Also, it would be necessary to remove the old event listener and create a new one each time, so re-creating the whole button seems to be easier
  const btnChooseNone = document.createElement("button");
  btnChooseNone.innerHTML = "None of these games /<br>I'm not sure";
  btnChooseNone.addEventListener("click", () => {
    headingChooseGame.classList.add("hidden");
    tileContainer.innerHTML = "";
    processResult(
      null,
      searchTerm,
      "Search results didn't include the right game"
    );
  });

  tileContainer.appendChild(btnChooseNone);

  // Sort games by popularity
  // Use number of people who voted for recommended player number as approximation for popularity
  // Alternatively, one could set the URL param "stats=1" to get better indicators, but this would increase the size of each request
  arItemsOfRequestByIdList.sort(
    (a, b) =>
      +b
        .querySelector("[name='suggested_numplayers']")
        .getAttribute("totalvotes") -
      +a
        .querySelector("[name='suggested_numplayers']")
        .getAttribute("totalvotes")
  );

  // Create a tile for each game for the user to choose from
  arItemsOfRequestByIdList.forEach((result) => {
    const tile = document.createElement("div");
    tile.classList.add("tile");
    const thumbnail = result.querySelector("thumbnail")
      ? result.querySelector("thumbnail").textContent
      : "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";
    const year = result.querySelector("yearpublished").getAttribute("value");
    const linkElement = `<a href="${BASE_URL}/boardgame/${result.id}" target="_blank">BGG&nbsp;&neArr;</a>`;
    const primaryName = result
      .querySelector("name[type='primary']")
      .getAttribute("value");

    // If the primary name of the game isn't already equal to the search term, get all alternate names that are
    let listOfMatchingAlternateNames = "";
    if (primaryName.toLowerCase() !== searchTerm.toLowerCase()) {
      const arAllAlternateNames = Array.from(
        result.querySelectorAll("name[type='alternate']")
      ).map((nameElement) => nameElement.getAttribute("value"));
      let arMatchingAlternateNames = arAllAlternateNames.filter(
        (name) => name.toLowerCase() === searchTerm.toLowerCase()
      );
      // No perfect matches found -> look for general matches
      if (arMatchingAlternateNames.length === 0) {
        const regexSearchTerm = new RegExp(searchTerm, "i");
        arMatchingAlternateNames = arAllAlternateNames.filter((name) =>
          name.match(regexSearchTerm)
        );
      }
      // Anything found -> Wrap each name in quotes and the whole list in HTML tags and brackets
      if (arMatchingAlternateNames.length > 0) {
        listOfMatchingAlternateNames = arMatchingAlternateNames
          .map((name) => name.replace(/^|$/g, "&quot;"))
          .join(", ")
          .replace(/^/, "<span class='alternate-names'>(Also: ")
          .replace(/$/, ")<s/span>");
      }
    }

    tile.innerHTML = `<img data-game-id="${result.id}" src="${thumbnail}" />
                      <p><strong>${primaryName}</strong> (${year},&nbsp;${linkElement})<br>${listOfMatchingAlternateNames}</p>`;
    tile.querySelector("img").addEventListener("click", (e) => {
      headingChooseGame.classList.add("hidden");
      tileContainer.innerHTML = "";
      processResult(e.target.getAttribute("data-game-id"), searchTerm);
    });
    tileContainer.appendChild(tile);
  });
}

function processResult(id, searchTerm, status = "Success") {
  const statusInTable = document.querySelectorAll("#progress-table .status")[i];
  statusInTable.textContent = status;
  if (id) {
    arFoundIds.push(id);
    statusInTable.style.backgroundColor = "var(--green)";
    statusInTable.style.color = "var(--text-on-green)";
  } else {
    arGamesWithNoIdFound.push(searchTerm);
    statusInTable.style.backgroundColor = "var(--red)";
    statusInTable.style.color = "var(--text-on-red)";
  }
  ++i;
  setTimeout(processNextGame, 750);
}

function announceFinalResults() {
  let csvResults = "";
  if (arFoundIds.length > 0) {
    document.querySelector("#paragraph-id-list").classList.remove("hidden");
    document.querySelector("#id-list").textContent = arFoundIds.join(", ");
    csvResults += `"Successfully identified ID's",${arFoundIds
      .map((id) => id.replace(/^|$/g, '"'))
      .join(",")}\n`;
  }
  if (arGamesWithNoIdFound.length > 0) {
    document.querySelector("#paragraph-no-matches").classList.remove("hidden");
    document.querySelector("#no-matches").textContent =
      arGamesWithNoIdFound.join(", ");
    csvResults += `"Games, where no ID could be found",${arGamesWithNoIdFound
      .map((name) => name.replace(/^|$/g, '"'))
      .join(",")}\n`;
  }
  if (arSkippedGames.length > 0) {
    console.log("hey");
    document.querySelector("#paragraph-skipped").classList.remove("hidden");
    document.querySelector("#skipped").textContent = arSkippedGames.join(", ");
    csvResults += `"Skipped games",${arSkippedGames
      .map((name) => name.replace(/^|$/g, '"'))
      .join(",")}`;
  }
  document.querySelector("#download").addEventListener("click", () => {
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(csvResults)}`
    );
    downloadLink.setAttribute("download", `bgg-game-to-id.csv`);
    document.querySelector("body").appendChild(downloadLink);
    downloadLink.click();
    document.querySelector("body").removeChild(downloadLink);
  });
  hideOldAndShowNextSection("processing", "results");
}
