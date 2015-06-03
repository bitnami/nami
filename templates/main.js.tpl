'use strict';

// INSTALLATION HOOKS: These are methods that will be executed during the installation of the application, in order of execution.

// Executed after files are unpacked
$app.postUnpackFiles = function() {
  $app.info('After unpacking the files');
  $app.trace(`I'm useful for changing permissions or creating directories that will be required during installation`);
};

// Executed before files are unpacked
$app.preUnpackFiles = function() {
  $app.info('Before unpacking the files');
  $app.trace(`I'm useful for ensuring services are not running so files can safely be overwritten`);
};

// Executed after $app.postUnpackFiles. This is skipped if the "unpack" command is used instead of "install". It is also the only
// one executed if using the "initialize" command.
$app.postInstallation = function() {
  $app.info('Running post installation');
  $app.trace(`I'm useful for creating databases, changing passwords...`);
};

// UNINSTALLATION HOOKS: These are methods that will be executed during the uninstallation of the application, in order of execution.

// Executed right before the removal of files start.
$app.preUninstallation = function() {
  $app.info('Running pre-uninstallation.');
  $app.trace(`I'm useful for stopping services, removing temporary folders...`);
};

// Executed right after the removal of files ends. Useful for doing cleanup:
$app.postUninstallation = function() {
  $app.info('Running post-uninstallation.');
  $app.trace(`I'm useful for cleaning up directories left behind such as temporary folders or removing users from the system`);
};
