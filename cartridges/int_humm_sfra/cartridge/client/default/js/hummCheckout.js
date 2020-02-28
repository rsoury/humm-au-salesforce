'use strict';
/* global $ */

var formHelpers = require('base/checkout/formErrors');
var scrollAnimate = require('base/components/scrollAnimate');

var humm = {
    redirect: function () {
        var csrfToken = $('input[name="csrf_token"]').val();
        var isHummUrl = $('input[name="dwfrm_humm_isHummUrl"]').val();

        $.ajax({
            url: isHummUrl + '?csrf_token=' + csrfToken,
            type: 'post',
            success: function (data) {
                if (data && data.isHumm !== undefined && data.isHumm) {
                    // payment method is humm
                    $('button.submit-payment').text(data.resource.pleaseWait);
                    var redirectMessage = data.resource.redirectMessage;
                    var redirectHummUrl = $('input[name="dwfrm_humm_redirectHummUrl"]').val();
                    // get redirect url
                    $.ajax({
                        url: redirectHummUrl + '?csrf_token=' + csrfToken,
                        type: 'post',
                        success: function (redirectData) {
                            var defer = new $.Deferred();
                            $('.alert.error-message').html('<p class="error-message-text"></p>');
                            $('.alert.error-message p.error-message-text').text(redirectMessage);
                            if (redirectData.error) {
                                if (redirectData.cartError) {
                                    window.location.href = redirectData.cartUrl;
                                    defer.reject();
                                } else {
                                    // go to appropriate stage and display error message
                                    defer.reject(redirectData);
                                }
                            } else {
                                var urlParams;
                                var redirectUrl = redirectData.redirectUrl;
                                if (redirectData.hummSignatureResponse != null) {
                                    urlParams = {
                                        hummSignature: encodeURIComponent(redirectData.hummSignatureResponse),
                                        hummOrderNo: encodeURIComponent(redirectData.orderNo),
                                        countryCode: redirectData.countryCode
                                    };
                                } else {
                                    urlParams = {
                                        errorMessage: redirectData.redirectTokenResponse.errorMessage.message,
                                        errorCode: redirectData.redirectTokenResponse.errorMessage.httpStatusCode
                                    };
                                }
                                redirectUrl += (redirectUrl.indexOf('?') !== -1 ? '&' : '?') +
                                Object.keys(urlParams).map(function (key) {
                                    return key + '=' + encodeURIComponent(urlParams[key]);
                                }).join('&');
                                window.location.href = redirectUrl;
                                defer.reject();
                            }
                        }
                    });
                }
            }
        });
    },
    generalValidation: function () {
        //
        // Submit the Billing Address Form
        //

        formHelpers.clearPreviousErrors('.payment-form');

        var billingAddressForm = $('#dwfrm_billing .billing-address-block').serialize();
        var defer = $.Deferred(); // eslint-disable-line

        $('body').trigger('checkout:serializeBilling', {
            form: $('#dwfrm_billing .billing-address-block'),
            data: billingAddressForm,
            callback: function (data) {
                if (data) {
                    billingAddressForm = data;
                }
            }
        });

        var contactInfoForm = $('#dwfrm_billing .contact-info-block').serialize();

        $('body').trigger('checkout:serializeBilling', {
            form: $('#dwfrm_billing .contact-info-block'),
            data: contactInfoForm,
            callback: function (data) {
                if (data) {
                    contactInfoForm = data;
                }
            }
        });

        var activeTabId = $('.tab-pane.active').attr('id');
        var paymentInfoSelector = '#dwfrm_billing .' + activeTabId + ' .payment-form-fields';
        var paymentInfoForm = $(paymentInfoSelector).serialize();

        $('body').trigger('checkout:serializeBilling', {
            form: $(paymentInfoSelector),
            data: paymentInfoForm,
            callback: function (data) {
                if (data) {
                    paymentInfoForm = data;
                }
            }
        });

        var paymentForm = billingAddressForm + '&' + contactInfoForm + '&' + paymentInfoForm;

        if ($('.data-checkout-stage').data('customer-type') === 'registered') {
            // if payment method is credit card
            if ($('.payment-information').data('payment-method-id') === 'CREDIT_CARD') {
                if (!($('.payment-information').data('is-new-payment'))) {
                    var cvvCode = $('.saved-payment-instrument.' +
                        'selected-payment .saved-payment-security-code').val();

                    if (cvvCode === '') {
                        var cvvElement = $('.saved-payment-instrument.' +
                            'selected-payment ' +
                            '.form-control');
                        cvvElement.addClass('is-invalid');
                        scrollAnimate(cvvElement);
                        defer.reject();
                        return defer;
                    }

                    var $savedPaymentInstrument = $('.saved-payment-instrument' +
                        '.selected-payment'
                    );

                    paymentForm += '&storedPaymentUUID=' +
                        $savedPaymentInstrument.data('uuid');

                    paymentForm += '&securityCode=' + cvvCode;
                }
            }
        }
        // disable the next:Place Order button here
        $('body').trigger('checkout:disableButton', '.next-step-button button');

        $.ajax({
            url: $('#dwfrm_billing').attr('action'),
            method: 'POST',
            data: paymentForm,
            success: function (data) {
                 // enable the next:Place Order button here
                $('body').trigger('checkout:enableButton', '.next-step-button button');
                // look for field validation errors
                if (data.error) {
                    if (data.fieldErrors.length) {
                        data.fieldErrors.forEach(function (error) {
                            if (Object.keys(error).length) {
                                formHelpers.loadFormErrors('.payment-form', error);
                            }
                        });
                    }

                    if (data.serverErrors.length) {
                        data.serverErrors.forEach(function (error) {
                            $('.error-message').show();
                            $('.error-message-text').text(error);
                            scrollAnimate($('.error-message'));
                        });
                    }

                    if (data.cartError) {
                        window.location.href = data.redirectUrl;
                    }

                    defer.reject();
                } else {
                    //
                    // Populate the Address Summary
                    //
                    if (data.renderedPaymentInstruments) {
                        $('.stored-payments').empty().html(
                            data.renderedPaymentInstruments
                        );
                    }

                    if (data.customer.registeredUser
                        && data.customer.customerPaymentInstruments.length
                    ) {
                        $('.cancel-new-payment').removeClass('checkout-hidden');
                    }

                    scrollAnimate();

                    if (data.hummEnabled) {
                        // Initalize hummCheckout
                        humm.redirect();
                    } else {
                        defer.resolve(data);
                    }
                }
            },
            error: function (err) {
                // enable the next:Place Order button here
                $('body').trigger('checkout:enableButton', '.next-step-button button');
                if (err.responseJSON && err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                }
            }
        });

        return defer;
    },
    selectPaymentMethod: function () {
        if ($('ul.payment-options li.nav-item').length === 1) {
            $('ul.payment-options li.nav-item a.nav-link.humm-tab').addClass('active');
            $('.tab-pane.humm-content').addClass('active');
        }
    }
};

$(document).ready(function () {
    humm.selectPaymentMethod();

    $(document).ajaxComplete(function () {
        humm.selectPaymentMethod();
    });

    $('button.submit-payment').on('click', function (e) {
        var isHummTab = $('.humm-tab').hasClass('active');

        if (isHummTab) {
            e.stopPropagation();
            humm.generalValidation();
        }
    });
});
