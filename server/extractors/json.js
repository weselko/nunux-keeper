var logger     = require('../helpers').logger,
    when       = require('when'),
    fs         = require('fs'),
    JSONStream = require('JSONStream');

/**
 * Import new document.
 * @param {Object} data document data
 * @param {String} owner owner
 * @return {Promise} Promise of the importation.
 */
var importDocument = function(data, owner) {
  var doc = {
    title: data.title,
    content: data.content ? data.content.content : data.summary ? data.summary.content : '',
    contentType: 'text/html',
    link: data.canonical ? data.canonical[0].href : data.alternate ? data.alternate[0].href : null,
    owner: owner
  };

  logger.debug('Importing document "%s" ...', doc.title);

  return when.resolve(doc);
};


/**
 * Import attached JSON.
 * @param {Document} doc document
 * @return {Promise} Promise of the importation.
 */
var importAttachedJSON = function(doc) {
  logger.debug('Import attached JSON %s ...', doc.attachment.name);
  var imported = when.defer(),
      items = [];
  // Parse file...
  var parser = JSONStream.parse('items.*');
  parser.on('end', function(err) {
    when.all(items).then(function(documents) {
      logger.debug('%d documents extracted.', documents.length);
      imported.resolve(documents);
    }, imported.reject);
  });
  parser.on('error', function(err) {
    logger.error('Error while importing file %s of user %s', doc.attachment.name, doc.owner, err);
    items.push(when.reject(err));
  });
  parser.on('data', function(data) {
    items.push(importDocument(data, doc.owner));
  });
  doc.attachment.stream.pipe(parser);

  return imported.promise;
};

/**
 * JSON content extractor.
 * This extractor ican create multi documents.
 * @module json
 */
module.exports = {
  /**
   * Extract content of a document.
   * @param {Document} doc
   * @return {Promise} Promise of the document with extracted content.
   */
  extract: function(doc) {
    logger.debug('Using JSON extractor.');

    if (doc.attachment) {
      return importAttachedJSON(doc);
    } else {
      // Nothing else to do... forward the doc.
      return when.resolve(doc);
    }
  }
};