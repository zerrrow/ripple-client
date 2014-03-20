var util = require('util');
var Tab = require('../client/tab').Tab;

var RegisterTab = function ()
{
  Tab.call(this);
};

util.inherits(RegisterTab, Tab);

RegisterTab.prototype.tabName = 'register';
RegisterTab.prototype.pageMode = 'single';
RegisterTab.prototype.parent = 'main';

RegisterTab.prototype.generateHtml = function ()
{
  return require('../../jade/tabs/register.jade')();
};

RegisterTab.prototype.angular = function (module) {
  module.controller('RegisterCtrl', ['$scope', '$location', '$element',
                                     '$timeout', 'rpId', 'rpTracker',
                                     'rpAuthInfo',
                                     function ($scope, $location, $element,
                                               $timeout, $id, $rpTracker,
                                               authinfo)
  {
    if ($id.loginStatus) {
      $location.path('/balance');
      return;
    }

    // Countries list
    var lang = store.get('ripple_language') || 'en';

    $scope.countries = _.sortBy(require('../l10n/countries/' + lang + '.json'),
      function(country){
        return country;
      }
    );

    $scope.reset = function()
    {
      $scope.username = '';
      $scope.password = '';
      $scope.passwordSet = {};
      $scope.password1 = '';
      $scope.password2 = '';
      $scope.master = '';
      $scope.key = '';
      $scope.mode = 'form';
      $scope.showMasterKeyInput = false;
      $scope.submitLoading = false;
      $scope.track = true;

      if ($scope.registerForm) $scope.registerForm.$setPristine(true);
    };

    var debounce;
    $scope.$watch('username', function (username) {
      $scope.usernameStatus = null;

      if (debounce) $timeout.cancel(debounce);

      if (!username) {
        // No username entered, show nothing, do nothing
      } else if (username.length < 2) {
        $scope.usernameStatus = "invalid";
        $scope.usernameInvalidReason = "tooshort";
      } else if (username.length > 15) {
        $scope.usernameStatus = "invalid";
        $scope.usernameInvalidReason = "toolong";
      } else if (!/^[a-zA-Z0-9\-]+$/.exec(username)) {
        $scope.usernameStatus = "invalid";
        $scope.usernameInvalidReason = "charset";
      } else if (/^-/.exec(username)) {
        $scope.usernameStatus = "invalid";
        $scope.usernameInvalidReason = "starthyphen";
      } else if (/-$/.exec(username)) {
        $scope.usernameStatus = "invalid";
        $scope.usernameInvalidReason = "endhyphen";
      } else if (/--/.exec(username)) {
        $scope.usernameStatus = "invalid";
        $scope.usernameInvalidReason = "multhyphen";
      } else {
        debounce = $timeout(checkUsername, 800);
      }
    });

    function checkUsername() {
      $scope.usernameStatus = null;
      if (!$scope.username) return;

      $scope.usernameStatus = 'loading';
      authinfo.get(Options.domain, $scope.username, function (err, info) {
        if (err) {
          // XXX Better error handling
          $scope.usernameStatus = null;
          return;
        }
        if (info.exists) {
          $scope.usernameStatus = "exists";
        } else if (info.reserved) {
          $scope.usernameStatus = "reserved";
          $scope.usernameReservedFor = info.reserved;
        } else {
          $scope.usernameStatus = "ok";
        }
      });
    }

    $scope.register = function()
    {
      if ($scope.oldUserBlob) {
        $scope.masterkey = $scope.oldUserBlob.data.master_seed;
      }

      $id.register({
        'username': $scope.username,
        'password': $scope.password1,
        'masterKey': $scope.masterkey,
        'oldUserBlob': $scope.oldUserBlob
      },
      function(err, key){
        if (err) {
          $scope.mode = "failed";
          $scope.error_detail = err.message;
          return;
        }
        $scope.password = new Array($scope.password1.length+1).join("*");
        $scope.keyOpen = key;
        $scope.key = $scope.keyOpen[0] + new Array($scope.keyOpen.length).join("*");

        // TODO send verification email
//        $scope.mode = 'verification';
        $scope.mode = 'verified';
      });
    };

    var updateFormFields = function(){
      var username;
      var password1;
      var password2;

      username = $element.find('input[name="register_username"]').eq(0).val();
      password1 = $element.find('input[name="register_password1"]').eq(0).val();
      password2 = $element.find('input[name="register_password2"]').eq(0).val();

      if ("string" === typeof username) {
        $scope.registerForm.register_username.$setViewValue(username);
      }
      if ("string" === typeof password1) {
        $scope.registerForm.register_password1.$setViewValue(password1);
      }
      if ("string" === typeof password2) {
        $scope.registerForm.register_password2.$setViewValue(password2);
      }
    };

    /**
     * Registration cases
     *
     * -- CASE --                                                            -- ACTION --
     * 1. username or/and password is/are missing ----------------------------- show error
     * 2. passwords do not match ---------------------------------------------- show error
     * 3. username and password passed the validation
     *    3.1 master key is not present
     *        3.1.1 account exists
     *              3.1.1.1 and we can login ---------------------------------- login
     *              3.1.1.2 and we can't login -------------------------------- show error
     *        3.1.2 account doesn't exist ------------------------------------- register and generate master key
     *    3.3 master key is present
     *        3.3.1 account exists, but we can't login ------------------------ show error
     *        3.3.2 account exists and it uses the same master key =----------- login
     *        3.3.3 account exists, and it uses another master key
     *              3.3.2.1 master key is valid ------------------------------- tell him about the situation, and let him decide what to do
     *              3.3.2.2 master key is invalid ----------------------------- show error
     *        3.3.3 account doesn't exist ------------------------------------- register with given master key
     */

    $scope.submitForm = function()
    {
      // Disable submit button
      $scope.submitLoading = true;

      updateFormFields();

      var regInProgress;

      // TODO Update this. It cannot exist anymore, 'cause usernames are unique
      $id.exists($scope.username, $scope.password1, function (error, exists) {
        if (!regInProgress) {
          if (!exists) {
            regInProgress = true;

            if (Options.mixpanel) {
              // XXX You should never modify the Options object!!
              Options.mixpanel.track = $scope.track;
            }

            if (!store.disabled) {
              store.set('ripple_settings', JSON.stringify(Options));
            }

            $scope.register();
          } else {
            $scope.mode = 'alreadyexists';
          }
        }
      });
    };

    $scope.goToBalance = function()
    {
      $scope.mode = 'form';
      $scope.reset();

      $rpTracker.track('Sign Up', {
        'Used key': !!$scope.masterkey,
        'Password strength': $scope.strength,
        'Showed secret key': !!$scope.showSecret,
        'Showed password': !!$scope.showPassword
      });

      $location.path('/balance');
    };

    $scope.reset();
  }]);
};

module.exports = RegisterTab;
