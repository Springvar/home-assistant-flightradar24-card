export function renderFlag(countryCode, countryName) {
  const flagElement = document.createElement("img");
  flagElement.setAttribute(
    "src",
    `https://flagsapi.com/${countryCode}/shiny/16.png`
  );
  flagElement.setAttribute("title", `${countryName}`);
  flagElement.style.position = "relative";
  flagElement.style.top = "3px";
  flagElement.style.left = "2px";
  return flagElement;
}
