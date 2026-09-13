(function () {
  'use strict';

  function openExternalLinksInNewTab(root) {
    var links = [];

    if (root.nodeType === Node.ELEMENT_NODE && root.matches('a[href]')) {
      links.push(root);
    }
    if (root.querySelectorAll) {
      links = links.concat(Array.from(root.querySelectorAll('a[href]')));
    }

    links.forEach(function (link) {
      var url;

      try {
        url = new URL(link.href, window.location.href);
      } catch (error) {
        return;
      }

      if (!/^https?:$/.test(url.protocol) || url.origin === window.location.origin) {
        return;
      }

      link.target = '_blank';
      var rel = new Set((link.rel || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.rel = Array.from(rel).join(' ');
    });
  }

  openExternalLinksInNewTab(document);

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(openExternalLinksInNewTab);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
}());
