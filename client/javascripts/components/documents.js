
angular.module('DocumentsModule', ['ngRoute', 'angularFileUpload', 'infinite-scroll'])
.directive('appDocuments', ['$location', function($location) {
  return {
    restrict: 'E',
    templateUrl: 'templates/components/documents.html',
    controller: 'DocumentsCtrl'
  };
}])
.controller('DocumentsCtrl', [
  '$rootScope', '$scope', '$routeParams', 'categoryService',
  'documentService', '$modal', '$log', '$timeout',
  function ($rootScope, $scope, $routeParams, categoryService,
            documentService, $modal, $log, $timeout) {
    'use strict';
    var m, size = 20, initializing = true;
    $scope.emptyMessage = 'No documents found.';
    $scope.isSearch = false;
    switch (true) {
      case !$routeParams.q:
        $scope.title = 'All';
        break;
      case '_missing_:category' === $routeParams.q:
        $scope.title = 'Uncategorized';
        break;
      case (m = $routeParams.q.match(/^category:([a-z\-]+)$/)) !== null:
        $scope.category = categoryService.get(m[1]);
        if ($scope.category) {
          $scope.trash = $scope.category.key === 'system-trash';
          if ($scope.trash) {
            $scope.emptyMessage = 'Trash bin is empty.';
          }
        }
        break;
      default:
        $scope.title = 'Search';
        $scope.isSearch = true;
    }

    $scope.documents = [];
    $scope.from = 0;
    $scope.isnext = true;
    $scope.invert = false;
    $scope.fetchDocuments = function() {
      if (!$scope.isnext) return;
      $log.debug('Fetching documents...');
      documentService.fetch($routeParams.q, $scope.from, size, $scope.invert ? 'asc' : 'desc')
      .then(function(data) {
        initializing = false;
        if (data.hits.length == size && $scope.from + size < data.total) {
          $scope.from += size;
          $scope.isnext = true;
        } else {
          $scope.isnext = false;
        }

        _.each(data.hits, function(doc) {
          if (/^image\//.test(doc.contentType)) {
            doc.illustration = '/api/document/' +
              doc._id + '/attachment';
          }
          $scope.documents.push(doc);
        });

        $rootScope.$broadcast('app.event.hits', {
          query: $routeParams.q,
          total: data.total
        });
      });
    };

    $scope.refresh = function() {
      $scope.documents = [];
      $scope.from = 0;
      $scope.isnext = true;
      $scope.fetchDocuments();
    };

    $scope.$watch('invert', function(newValue) {
      if (!initializing) $scope.refresh();
    });

    $scope.trashDocuments = function() {
      if (confirm('Are you sure you want to remove the items in the Trash permanently?')) {
        documentService.trash()
        .then(function() {
          $scope.doc = null;
          $scope.documents = [];
        });
      }
    };

    $scope.openDocument = function(id) {
      _.each($scope.documents, function(doc) {
        doc.clazz = doc._id == id ? 'active' : '';
      });
      $scope.editing = false;
      documentService.get(id)
      .then(function(doc) {
        $scope.doc = doc;
        $timeout(function() {
          $scope.doc.opened = true;
        }, 300);
      });
    };

    $scope.closeDocument = function() {
      delete $scope.doc;
    };

    $scope.showDocumentCreationDialog = function() {
      var modalInstance = $modal.open({
        templateUrl: 'templates/dialog/document/create.html',
        controller: 'DocumentCreationModalCtrl',
        resolve: {
          category: function () {
            return $scope.category;
          }
        }
      });

      modalInstance.result.then(function(doc) {
        if (!doc._id) {
          $scope.editing = true;
        } else {
          $scope.documents.unshift(doc);
        }
        $scope.doc = doc;
        $timeout(function() {
          $scope.doc.opened = true;
        }, 300);
      }, function (reason) {
        $log.info('Document creation modal dismissed: ' + reason);
      });
    };

    $scope.removeDocument = function() {
      _.remove($scope.documents, function(doc) { return $scope.doc._id === doc._id; });
      delete $scope.doc;
    };

    $scope.addDocument = function(doc) {
      $scope.documents.push(doc);
    };

    $scope.getDraggableData = function(doc) {
      var data = {
        document: {
          _id: doc._id,
          categories: doc.categories
        }
      };
      return JSON.stringify(data);
    };

    $scope.$on('document-created', function(event, data) {
      $scope.addDocument(data.doc);
    });

    Mousetrap.bind(['n'], function() {
      if ($scope.doc) {
        var el = document.getElementById($scope.doc._id);
        el = el.nextElementSibling;
        if (el) {
          el.scrollIntoView(true);
          el.click();
        }
      }
    });
    Mousetrap.bind(['p'], function() {
      if ($scope.doc) {
        var el = document.getElementById($scope.doc._id);
        el = el.previousElementSibling;
        if (el && el.hasAttribute('id')) {
          el.scrollIntoView(true);
          el.click();
        }
      }
    });

  }
])
.controller('DocumentCreationModalCtrl', [
  '$log', '$scope', '$modalInstance', '$upload', 'documentService', 'category',
  function ($log, $scope, $modalInstance, $upload, documentService, category) {
    'use strict';
    $scope.category = category;
    $scope.processing = false;
    var doc = {
      categories: $scope.category ? [$scope.category.key] : []
    };

    var errHandler = function(err) {
      alert('Error: ' + err);
      $scope.processing = false;
      $modalInstance.dismiss('Error: ' + err);
    };

    $scope.postSimpleHtml = function() {
      doc.title = 'My new document';
      doc.content = '<p>what\'s up ?</p>';
      doc.contentType = 'text/html';
      $modalInstance.close(doc);
    };

    $scope.postSimpleText = function() {
      doc.title = 'My new document';
      doc.content = 'what\'s up ?';
      doc.contentType = 'text/plain';
      $modalInstance.close(doc);
    };

    $scope.postUrl = function() {
      if (!this.urlForm.$valid) return;
      $scope.processing = true;
      doc.content = this.url;
      doc.contentType = 'text/uri' + (this.isBookmark ? ';bookmark' : '');
      documentService.create(doc)
      .then($modalInstance.close, errHandler);
    };

    $scope.postFile = function(files) {
      if (!this.fileForm.$valid || !files) return;
      $scope.processing = true;
      doc.file = files[0];
      doc.contentType = 'multipart/form-data';
      documentService.create(doc)
      .then($modalInstance.close, errHandler);
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])
.filter('categoryColor', ['categoryService', function(categoryService) {
  'use strict';
  return function(val) {
    var cat = categoryService.get(val);
    return cat ? cat.color : '#fff';
  };
}]);
