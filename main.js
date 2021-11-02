/**
 * Copyright (c) 2019 and later, Isiah Meadows <contact@isiahmeadows.com>.
 * Source + Docs: https://gist.github.com/isiahmeadows/63716b78c58b116c8eb7
 *
 * # Blue Oak Model License
 *
 * Version 1.0.0
 *
 * ## Purpose
 *
 * This license gives everyone as much permission to work with this software as
 * possible, while protecting contributors from liability.
 *
 * ## Acceptance
 *
 * In order to receive this license, you must agree to its rules. The rules of
 * this license are both obligations under that agreement and conditions to your
 * license. You must not do anything with this software that triggers a rule
 * that you cannot or will not follow.
 *
 * ## Copyright
 *
 * Each contributor licenses you to do everything with this software that would
 * otherwise infringe that contributor's copyright in it.
 *
 * ## Notices
 *
 * You must ensure that everyone who gets a copy of any part of this software
 * from you, with or without changes, also gets the text of this license or a
 * link to <https://blueoakcouncil.org/license/1.0.0>.
 *
 * ## Excuse
 *
 * If anyone notifies you in writing that you have not complied with Notices,
 * you can keep your license by taking all practical steps to comply within 30
 * days after the notice. If you do not do so, your license ends immediately.
 *
 * ## Patent
 *
 * Each contributor licenses you to do everything with this software that would
 * otherwise infringe any patent claims they can license or become able to
 * license.
 *
 * ## Reliability
 *
 * No contributor can revoke this license.
 *
 * ## No Liability
 *
 * ***As far as the law allows, this software comes as is, without any warranty
 * or condition, and no contributor will be liable to anyone for any damages
 * related to this software or this license, under any kind of legal claim.***
 */

/* global Session, LockService, Logger, PropertiesService, */
/* global ScriptApp, GmailApp, __setup */
/* exported __setup, __install, __uninstall, __runQueries, __emailResults */
var __i, __u, __r, __e;
function __install() { __i(); }
function __uninstall() { __u(); }
function __runQueries() { __r(); }
function __emailResults() { __e(); }

(() => {
  "use strict";

  const opts = __setup

  function writeLine(str) {
    Logger.log(`== Timed Filters == ${str != null ? str : ''}`);
  }

  writeLine('LOG: Initializing script.');

  // Increment this any time a breaking change occurs
  const ScriptVersion = 1;

  // Helpful message in case of validation error
  const invalidSuffix =
    'Please fix this as soon as possible. Documentation for this script can ' +
    'be found at https://gist.github.com/isiahmeadows/63716b78c58b116c8eb7.';

  function require(errs, name, obj, types, isOptional) {
    if (obj == null) {
      if (isOptional) return;
    } else {
      for (const type of types) {
        if (type === 'array') {
          if (Array.isArray(obj)) return;
        } else if (type === 'integer') {
          if (typeof obj === 'number' && obj % 1 === 0) return;
        } else {
          if (typeof obj === type) return;
        }
      }
    }
    let message = `${name} must be a${/^[aeiou]/.test(types[0]) ? 'n' : ''} `;
    if (types.length === 1) {
      message += types[0]
    } else if (types.length === 2) {
      message += `${types[0]} or ${types[1]}`
    } else {
      const last = types.pop()
      message += `${types.join(', ')}, or ${last}`
    }
    errs.push(isOptional ? `${message} when given.` : `${message}.`);
  }

  var memoOptions;

  function getOptions() {
    if (memoOptions != null) return memoOptions;
    const errs = [];
    let notify;

    require(errs, 'queries', opts.queries, ['array']);
    for (const [search, operation] of opts.queries) {
      require(errs, 'query[0]', search, ['string']);
      require(errs, 'query[1]', operation, ['function']);
    }
    require(errs, 'notify', opts.notify, ['boolean', 'object'], true);
    if (opts.notify != null) {
      if (typeof opts.notify === 'object') {
        const { email, subject, body } = opts.notify;
        require(errs, 'notify.email', email, ['string'], true);
        require(errs, 'notify.subject', subject, ['string'], true);
        require(errs, 'notify.body', body, ['string'], true);
        notify = { email, subject, body };
      } else if (opts.notify === true) {
        notify = { email: null, subject: null, body: null }
      }
      // If it's explicitly not present, we can assume it's valid
      if (notify.email == null) {
        notify.email = Session.getEffectiveUser().getEmail();
        if (!notify.email) {
          errs.push('Could not detect email - an explicit email is required.');
        }
      }
      if (notify.subject == null) {
        notify.subject = 'Weekly Filter Totals';
      }
      if (notify.body == null) {
        notify.body =
          'Number of threads successfully processed this past week: %c';
      }
    }

    if (errs.length) {
      throw new TypeError(`${errs.join('\n')}\n\n${invalidSuffix}`);
    }

    return memoOptions = { queries: opts.queries, notify: notify };
  }

  function init(name) {
    const options = getOptions();
    const properties = PropertiesService.getUserProperties();
    let version = properties.getProperty('version');
    if (version != null) {
      version = +version;
    } else if (properties.getProperty('total') != null) {
      version = 0; // Let's phase in the old variant.
    }
    writeLine(name);

    // The lock is needed to make sure the callbacks aren't executed while we
    // are setting them up, tearing them down, or if we're sending the summary
    // email. 60 minutes should be well more than enough to run.
    const lock = LockService.getUserLock();
    return {
      options, properties, version,
      log(str) { writeLine(`LOG: ${str}`); },
      error(str) { writeLine(`ERROR: ${str}`); },
      acquire(isPriority) {
        const ms = 1000 /*ms*/ * 60 /*s*/ * (isPriority ? 10 : 60) /*min*/;
        this.log('Waiting for lock...');
        try {
          lock.waitLock(ms);
          return this;
        } catch (_) {
          if (isPriority) throw new Error('Failed to acquire lock.');
          // A single lock failure isn't the end of the world here. The next
          // scheduled run should be able to clean up after this.
          this.error('Lock unable to be acquired. Skipping this run.');
          this.error();
          return;
        }
      },
      release() { lock.releaseLock(); },
      finish() {
        this.log('Script executed successfully.');
        writeLine();
      },
    };
  }

  __u = function uninstall() {
    const state = init('Uninstalling script.').acquire(true);

    try {
      state.log('Deleting properties...');
      state.properties.deleteAllProperties();
      state.log('Removing old triggers...');

      // Old trigger type
      for (const trigger of ScriptApp.getProjectTriggers()) {
        const name = trigger.getHandlerFunction();
        state.log(`Removing trigger for function: ${name}`);
        ScriptApp.deleteTrigger(trigger);
      }
    } finally {
      state.release();
    }

    state.finish();
  };

  __i = function install() {
    const state = init('Installing script.');

    if (state.version != null && state.version > ScriptVersion) {
      throw new Error(
        'To downgrade, fully uninstall and then reinstall. Downgrading while ' +
        'retaining old data is not supported.'
      );
    }

    state.acquire(true);

    try {
      if (state.version != null) {
        // Migrate if previously installed
        state.log('Updating properties...');
        state.properties.setProperty('version', ScriptVersion);

        state.log('Updating triggers...');
        // No triggers to migrate currently.
      } else {
        // Install from scratch
        state.log('Installing properties...');
        state.properties.setProperty('version', ScriptVersion);
        state.properties.setProperty('total', '0');

        state.log('Installing triggers...');
        ScriptApp.newTrigger('__runQueries')
          .timeBased()
          .everyHours(1)
          .create();

        ScriptApp.newTrigger('__emailResults')
          .timeBased()
          .atHour(0)
          .everyDays(1)
          .inTimezone('Europe/London')
          .create();
      }
    } finally {
      state.release();
    }

    state.finish();
  };

  __r = function runQueries() {
    const state = init('Running queries.');

    if (state.version == null) {
      throw new Error(
        'Please install (or reinstall) this script so this task can run.'
      );
    }

    for (const [query, callback] of state.options.queries) {
      // If we can't acquire the lock, just return
      if (!state.acquire(false)) return;

      try {
        state.log(`Executing query: ${query}`);
        let total = +state.properties.getProperty('total');

        try {
          for (const thread of GmailApp.search(query)) {
            const subject = thread.getFirstMessageSubject();
            state.log(`Processing Gmail thread: ${subject}`);
            total++;
            callback(thread);
          }
        } finally {
          state.properties.setProperty('total', `${total}`);
        }
      } finally {
        state.release();
      }
    }

    state.finish();
  };

  __e = function emailResults() {
    const state = init('Emailing results.');

    if (state.version == null) {
      throw new Error(
        'Please install (or reinstall) this script so this task can run.'
      );
    }

    const notify = state.options.notify;
    if (notify == null) {
      let total;
      total = +state.properties.getProperty('total');
      state.log(`Previous total: ${total}`);
      state.log('Not sending email because notify == null');
      return
    };

    state.acquire(true);
    let total;
    try {
      state.log('Generating email...');

      total = +state.properties.getProperty('total');
      state.log(`Previous total: ${total}`);
      state.log('Resetting total...');
      state.properties.setProperty('total', '0');
    } finally {
      state.release();
    }

    state.log('Sending email...');
    const body = notify.body.replace(/%c/g, total);

    state.log(`Email: ${notify.email}`);
    state.log(`Subject: ${notify.subject}`);
    state.log(`Body: ${body}`);
    GmailApp.sendEmail(notify.email, notify.subject, body);

    state.log('Email sent successfully');
    state.finish();
  };
})();