function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Study Notes Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}
