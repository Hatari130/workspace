(function(){
  "use strict";

  var STORAGE_KEY = "hatari.language.v1";
  var saved = "zh";
  try{
    saved = window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh";
  }catch(err){}

  function isEnglish(){
    return document.documentElement.getAttribute("data-lang") === "en";
  }

  function translate(root){
    var scope = root || document;
    var nodes = scope.querySelectorAll ? scope.querySelectorAll("[data-i18n-zh]") : [];
    for (var i=0;i<nodes.length;i++){
      var node = nodes[i];
      var value = node.getAttribute(isEnglish() ? "data-i18n-en" : "data-i18n-zh");
      if (value !== null) node.innerHTML = value;
    }

    var titles = scope.querySelectorAll ? scope.querySelectorAll("[data-i18n-title-zh]") : [];
    for (var j=0;j<titles.length;j++){
      var titleNode = titles[j];
      var title = titleNode.getAttribute(isEnglish() ? "data-i18n-title-en" : "data-i18n-title-zh");
      if (title !== null) titleNode.setAttribute("title",title);
    }
  }

  function updateSwitches(){
    var english = isEnglish();
    var options = document.querySelectorAll("[data-lang-option]");
    for (var i=0;i<options.length;i++){
      options[i].setAttribute("aria-pressed",String(options[i].getAttribute("data-lang-option") === (english ? "en" : "zh")));
    }
    var switches = document.querySelectorAll(".lang-switch");
    for (var j=0;j<switches.length;j++) switches[j].setAttribute("aria-label",english ? "Language" : "语言切换");
  }

  function apply(next, persist){
    var language = next === "en" ? "en" : "zh";
    document.documentElement.setAttribute("data-lang",language);
    document.documentElement.setAttribute("lang",language === "en" ? "en" : "zh-CN");
    window.HATARI_LANG = language;
    if (persist){
      try{ window.localStorage.setItem(STORAGE_KEY,language); }catch(err){}
    }
    translate(document);
    updateSwitches();
    document.dispatchEvent(new CustomEvent("hatari:languagechange",{detail:{lang:language}}));
  }

  document.documentElement.setAttribute("data-lang",saved);
  document.documentElement.setAttribute("lang",saved === "en" ? "en" : "zh-CN");
  window.HATARI_LANG = saved;

  function bind(){
    var options = document.querySelectorAll("[data-lang-option]");
    for (var i=0;i<options.length;i++){
      options[i].addEventListener("click",function(){
        apply(this.getAttribute("data-lang-option"),true);
      });
    }
    apply(saved,false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",bind);
  else bind();
})();
