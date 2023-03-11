# Identify the BoardGameGeek ID's of your boardgames

This website helps you to identify the [BoardGameGeek](https://boardgamegeek.com/) (BGG) ID's of your boardgames. With your ID list, you can then bulk upload your games into your BGG Collection using [this program](#).

## How to setup

Just download the `bgg-names-to-ids.html`, save it on your local computer and then open the HTML file with your browser. Voilá!

## How it works

This website sends the names you provide as search queries to the BGG database (via their [XML API](https://boardgamegeek.com/wiki/page/BGG_XML_API2)). When their is no unique match, the website will ask you for clarification.

## Know issues

- The BGG API cannot handle too many requests in a short time. This is usually not a big issue, because when the user is asked for clarification, this naturally creates a break for the BGG server to "recover". Also, there is an artificial break of 750 miliseconds between each new game. However, when the website does not ask for clarification for many games in a row (either because it finds perfect matches or because there aren't any search results), the BGG server will send a response with status code 429 "Too many requests" (the 750 miliseconds break is not long enough to prevent this). This response error is handled with an info popup and an automatic continuation after 30 seconds. So it's not a huge problem, but it's annoying. Also, it would be nice to spare the BGG servers from too many requests.
  - A solution to prevent the 429 response could be to increase the break between each search query. However, this would make the whole website run slower. I also don't know how long the break would need to be.
  - A better solution would be to decrease the amount of http requests sent to the BGG servers. Yet, I don't know how this could be done, since the BGG API apparently does not accept bundled requests for search queries (only for boardgames).
- It's not optimized to look good on mobile devices - try at your own risk.
