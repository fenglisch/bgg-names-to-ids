function makeRequestXML(url) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.send();
  if (xhr.status > 200) {
    console.error(
      `XMLHttpRequest failed. Status code ${xhr.status}. Check network tab.`
    );
    return "error";
  }
  return xhr.responseXML;
}

const arIdsForOutput = [];

const arNoMatches = [];

const BASE_URL = "https://boardgamegeek.com/xmlapi2/";

let arNamesFromInput = [];

const tileContainer = document.querySelector("#tile-container");

const headingChooseGame = document.querySelector("#heading-choose-game");

let i = 0;

document.querySelector("#start").addEventListener("click", () => {
  const inputFromTextarea = document.querySelector("textarea").value;
  console.log(inputFromTextarea);
  //   const uploadedFile = document.querySelector("input[type='file'");
  arNamesFromInput = inputFromTextarea
    .split(",")
    .map((name) => name.replace(/^ /, "").replace(/ $/, "").toLowerCase());
  document.body.removeChild(document.querySelector("#start-section"));
  processGame();
});

function announceComplete() {
  document.querySelector("#final-id-list").textContent =
    arIdsForOutput.join(", ");
  if (arNoMatches.length > 0) {
    document.querySelector("#section-no-matches").classList.remove("hidden");
    document.querySelector("#no-matches").textContent = arNoMatches.join(", ");
  }

  document.querySelector("#complete").classList.remove("hidden");
}

function processGame() {
  if (i === arNamesFromInput.length) {
    announceComplete();
    return;
  }
  const searchTerm = arNamesFromInput[i];
  console.log(searchTerm, i);
  const arMatchesIds = [];
  const xmlSearchResult = makeRequestXML(
    `${BASE_URL}search?query=${searchTerm}&type=boardgame`
  );

  const arSearchResultItems = xmlSearchResult.querySelectorAll(
    "item[type='boardgame']"
  );

  if (arSearchResultItems.length === 0) {
    console.log("No search result at all, check spelling");
    addIdAndProcessNextGame(null, searchTerm);
    return;
  }

  for (let j = 0; j < arSearchResultItems.length; j++) {
    const nameSearchResult = arSearchResultItems[j]
      .querySelector("name")
      .getAttribute("value")
      .toLowerCase();
    const idSearchResult = arSearchResultItems[j].id;

    if (nameSearchResult === searchTerm) {
      arMatchesIds.push(idSearchResult);
    }
  }
  if (arMatchesIds.length === 0) {
    console.log("No perfect match");
    const arIds = [];
    arSearchResultItems.forEach((result) => {
      arIds.push(result.id);
    });
    displayPotentialMatches(arIds, searchTerm);
    return;
  } else if (arMatchesIds.length === 1) {
    console.log("Exactly 1 perfect match");
    addIdAndProcessNextGame(arMatchesIds[0], searchTerm);
    return;
  } else {
    console.log("Many matches");
    displayPotentialMatches(arMatchesIds, searchTerm);
    return;
  }
}

function displayPotentialMatches(arIds, searchTerm) {
  console.log(arIds);
  document.querySelector("#search-term-in-heading").textContent = searchTerm;
  headingChooseGame.classList.remove("hidden");
  const btnChooseNone = document.createElement("button");
  btnChooseNone.textContent = "None of these games is right";
  btnChooseNone.addEventListener("click", () => {
    headingChooseGame.classList.add("hidden");
    tileContainer.innerHTML = "";
    addIdAndProcessNextGame(null, searchTerm);
    return;
  });
  tileContainer.appendChild(btnChooseNone);

  const arNodesSearchResults = makeRequestXML(
    `${BASE_URL}thing?id=${arIds.join(",")}&type=boardgame`
  ).querySelectorAll("item[type='boardgame']");

  if (arNodesSearchResults.length === 0) {
    console.log("No match at all");
    tileContainer.innerHTML = "";
    headingChooseGame.classList.add("hidden");
    addIdAndProcessNextGame(null, searchTerm);
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
      .getAttribute("value")
      .toLowerCase();
    let arAlternateNames = [];
    if (!primaryName.includes(searchTerm)) {
      arAlternateNames = Array.from(
        result.querySelectorAll("name[type='alternate']")
      )
        .map((node) =>
          node.getAttribute("value").toLowerCase().replace(/^|$/g, "&quot;")
        )
        .filter((name) => name.includes(searchTerm));
    }

    tile.innerHTML = `<img data-game-id="${result.id}" src="${thumbnail}" />\
          <p>${primaryName} (${year},&nbsp;${link})</p>\
            ${
              arAlternateNames.length > 0
                ? "<p>(" + arAlternateNames.join(", ") + ")</p>"
                : ""
            }
          `;
    tile.querySelector("img").addEventListener("click", (e) => {
      headingChooseGame.classList.add("hidden");
      tileContainer.innerHTML = "";
      addIdAndProcessNextGame(
        e.target.getAttribute("data-game-id"),
        searchTerm
      );
      return;
    });
    tileContainer.appendChild(tile);
  });
}

function addIdAndProcessNextGame(id, searchTerm) {
  if (id) arIdsForOutput.push(id);
  else arNoMatches.push(searchTerm);
  console.log(`Added ${id ? "ID " + id : "no ID"} for game "${searchTerm}"`);
  console.log(arIdsForOutput);
  ++i;
  setTimeout(processGame, 100);
}
