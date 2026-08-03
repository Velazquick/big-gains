(() => {
  const stylesheetId = 'big-gains-workout-controls';
  if (!document.getElementById(stylesheetId)) {
    const link = document.createElement('link');
    link.id = stylesheetId;
    link.rel = 'stylesheet';
    link.href = './workout-controls.css?v=19';
    document.head.appendChild(link);
  }

  const script = document.createElement('script');
  script.src = './workout-controls.js?v=19';
  script.defer = false;
  document.head.appendChild(script);
})();
