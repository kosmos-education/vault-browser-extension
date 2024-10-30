import Vault from './vault.js'
const notify = new Notify(document.querySelector('#notify'));

$( function() {

    //Form: Create a secret
    const dialogCreate = $( "#dialog-form-create" ).dialog({
      autoOpen: false,
      height: 300,
      width: 350,
      modal: true,
      buttons: {
        "Enregistrer": function(){
          const e =new CustomEvent("secret-added",{
            detail:{
              secretName: $( "#secret-create-name" ).val(),
              secretValue:  $( "#secret-create-value" ).val()
            }
          })
        document.dispatchEvent(e)
        dialogCreate.dialog( "close" );
      },
        "Annuler": function() {
          dialogCreate.dialog( "close" );
        }
      },
      close: function() {
        formCreate[ 0 ].reset();
      }
    });

    //Form: Edit a secret
    const dialogEdit = $( "#dialog-form-edit" ).dialog({
      autoOpen: false,
      height: 300,
      width: 350,
      modal: true,
      buttons: {
        "Enregistrer": function(){
          const e =new CustomEvent("secret-updated",{
            detail:{
              secretName: $( "#secret-edit-name" ).val(),
              secretValue:  $( "#secret-edit-value" ).val()
            }
          })
        document.dispatchEvent(e)
        dialogEdit.dialog( "close" );
      },
        "Annuler": function() {
          dialogEdit.dialog( "close" );
        }
      },
      close: function() {
        formEdit[ 0 ].reset();
      }
    });

  //Form: Select Secret key from the list
  const dialogSelectKeys = $( "#dialog-form-select-keys" ).dialog({
    autoOpen: false,
    height: 300,
    width: 350,
    modal: true,
    close: function() {
      formSelectKeys[ 0 ].reset();
    }
  });

    const formCreate = dialogCreate.find( "form" ).on( "submit", function( event ) {
      event.preventDefault();
    });

    const formEdit = dialogEdit.find( "form" ).on( "submit", function( event ) {
      event.preventDefault();
    });

  const formSelectKeys = dialogSelectKeys.find( "form" ).on( "submit", function( event ) {
    event.preventDefault();
  });

    $( "#add-secret" ).button().on( "click", function() {
      dialogCreate.dialog( "open" );
    });

    $("#select-keys-fieldset").on( "open", function(e) {
      dialogSelectKeys.dialog( "open" );
    });

    $("#select-keys-fieldset").on( "close", function(e) {
      dialogSelectKeys.dialog( "close" );
    });

    //Use document.body for binding elements after onload
    jQuery(document.body).on( "click","#edit-secret", function(e) {
      $( "#secret-edit-name" ).val(e.currentTarget.data.secretName)
      dialogEdit.dialog( "open" );
    });
  } );