var openpayu = openpayu || {};
openpayu.options = openpayu.options || {};

$(document).ready(function () {
    var $orderHistory = $('#order-history');
    var $retryPayment = $('#payuRetryPayment17');

    if ($orderHistory.length > 0) {
        $retryPayment.insertBefore($orderHistory);
    } else {
        var $retryPaymentTarget = $('.order-status').first();
        $retryPayment.insertBefore($retryPaymentTarget);
        $retryPayment.after('<hr class="order-separator"/>');
    }

    $('body').on('click', '.payu-read-more', function () {
        $(this).hide();
        var elementToShow = $(this).data('more');
        $('body #' + elementToShow).show();
    });
    if (window.location.hash == '#repayment') {
        setTimeout(function () {
            $('html, body').animate({
                scrollTop: $(".repayment-container").offset().top
            }, 1000);
        }, 500)
    }
});

(function () {

    document.addEventListener("DOMContentLoaded", function () {
        var transferResponseBox = null;
        var currentGateway = null;
        var paymentNotificationShown = false;

        bindTransferGateways();

        if (prestashop.is_one_page_checkout_enabled) {
            // One-page checkout renders payment methods via AJAX, after DOMContentLoaded
            prestashop.on('opcPaymentMethodsUpdated', () => {
                bindTransferGateways();
                addEventListenersToSubmitButton();
                scrollToPaymentNotification();
                initSecureForm();
                updateBinaryButtons();
            });

            document.addEventListener('change', function (e) {
                if (e.target.matches('[name=payment-option]')) {
                    updateBinaryButtons();
                }
            });

            var binaryButton = document.getElementById('payu-binary-button');
            if (binaryButton !== null) {
                binaryButton.addEventListener('click', function () {
                    var payMethod = getCheckedPayuPayMethod('.binary');

                    if (showOpcValidationErrors(getPayuBinaryBlock(payMethod))) {
                        return;
                    }

                    if (payMethod === 'card') {
                        payuCardValidate();
                    } else if (payMethod === 'ap') {
                        payuGooglePayValidate();
                    } else if (payMethod === 'jp') {
                        payuApplePayValidate();
                    }
                });
            }

            // runs before the one-page checkout handler of its pay button
            var isOpcFormValid = false;
            prestashop.on('opcFormValidated', function (e) {
                isOpcFormValid = e.isValid;
            });

            document.addEventListener('click', function (e) {
                // with an invalid form let one-page checkout show (and scroll to) its own errors as well
                if (e.target.closest('#opc-pay-button') && !validateTransferGateway(isOpcFormValid)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true);
        }
        else {
            addEventListenersToSubmitButton();
            scrollToPaymentNotification();
        }
        function validateBeforeSubmitGooglePay(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            payuGooglePayValidate();

            return false;
        }

        function validateBeforeSubmitApplePay(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            payuApplePayValidate();

            return false;
        }

        function validateBeforeSubmitCardForm(e) {
            if ($('.pay-card-init').is(':visible')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                payuCardValidate();
            }
            return false;
        }

        function validateBeforeSubmitTransfer(e) {
            if (!validateTransferGateway(true)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }

        function activatePaymentButton() {
            var paymentSubmit = document.querySelector('.pay-transfer-accept button');
            if (paymentSubmit !== null) {
                paymentSubmit.removeAttribute("disabled");
            }
        }

        function resetAllGatewaysActive() {
            Array.from(document.querySelectorAll('.pay-methods__item')).forEach(function (el) {
                el.classList.remove('payMethodActive');
            });

            if (currentGateway !== null) {
                currentGateway.value = '';
            }
        }

        function bindTransferGateways() {
            // the card form can render a notification box with the same id
            transferResponseBox = document.querySelector('.payment-name[data-pm=transfer] ~ #transfer-response-box')
                || document.getElementById('transfer-response-box');
            currentGateway = document.querySelector('input[name=transferGateway]');

            document.querySelectorAll('input[name=transfer_gateway_id]').forEach(function (gateway) {
                if (gateway.dataset.payuBound) {
                    return;
                }
                gateway.dataset.payuBound = '1';

                gateway.addEventListener('click', function (e) {

                        resetAllGatewaysActive();

                        var gatewayValue = this.value;
                        var gatewayItem = document.querySelector('#payMethodContainer-' + gatewayValue);
                        gatewayItem.classList.add('payMethodActive');

                        if (gatewayValue !== null && currentGateway !== null) {
                            currentGateway.value = gatewayValue;
                        }

                        if (transferResponseBox !== null) {
                            transferResponseBox.style.display = 'none';
                        }

                        activatePaymentButton();

                    }, true
                );
            });
        }

        var payu = null;
        var secureForms = null;
        var secureFormOptions = null;
        var secureFormNumber = null;
        var secureFormDate = null;
        var secureFormCvv = null;
        var cardTokenInput = null;

        initSecureForm();

        function initSecureForm() {
            var numberElement = document.getElementById('payu-card-number');

            // one-page checkout renders the card form via AJAX - render the fields whenever empty containers appear
            if (payuSFEnabled !== true || typeof PayU === 'undefined' || numberElement === null || numberElement.hasChildNodes()) {
                return;
            }

            // the SDK allows adding each field type only once, re-rendered payment methods get the same fields
            // (removed from the replaced elements first - render() of a rendered field does nothing)
            if (payu === null) {
                createSecureForms();
                secureFormNumber = secureForms.add('number', secureFormOptions.config);
                secureFormDate = secureForms.add('date', secureFormOptions.config);
                secureFormCvv = secureForms.add('cvv', secureFormOptions.config);
            } else {
                secureFormNumber.remove();
                secureFormDate.remove();
                secureFormCvv.remove();
            }

            secureFormNumber.render(secureFormOptions.elementFormNumber);
            secureFormDate.render(secureFormOptions.elementFormDate);
            secureFormCvv.render(secureFormOptions.elementFormCvv);

            cardTokenInput = document.getElementById('card-token');
        }

        function createSecureForms() {
            secureFormOptions = {
                elementFormNumber: '#payu-card-number',
                elementFormDate: '#payu-card-date',
                elementFormCvv: '#payu-card-cvv',
                element: '#secure-form',
                profile: 'widthGt300',
                profiles: {
                    widthLt290: {
                        cardIcon: false,
                        style: {
                            basic: {
                                fontSize: '14px',
                            }
                        },
                    },
                    widthLt340: {
                        cardIcon: true,
                        style: {
                            basic: {
                                fontSize: '14px',
                            }
                        },
                    },
                    widthGt340: {
                        cardIcon: true,
                        style: {
                            basic: {
                                fontSize: '18px',
                            }
                        },
                    }
                },
                config: {
                    cardIcon: true,
                    placeholder: {
                        number: '',
                        cvv: ''
                    },
                    style: {
                        basic: {
                            fontSize: '18px',
                        }
                    },
                    lang: payuLangId
                }
            };

            secureFormOptions.profile = calculateProfile();
            secureFormOptions.config = Object.assign({}, secureFormOptions.config, secureFormOptions.profiles[secureFormOptions.profile]);

            payu = PayU(payuPosId, {dev: true});
            secureForms = payu.secureForms();
            window.addEventListener('resize', secureFormResize);
        }

        function payuCardValidate() {

            hideMessageBoxSecureForm();
            cardTokenInput.value = '';
            secureFormNumber.update({disabled: true});
            secureFormDate.update({disabled: true});
            secureFormCvv.update({disabled: true});

            try {
                payu.tokenize().then(function (result) {
                    $('#payment-confirmation .btn')
                        .attr('disabled', 'disabled')
                        .addClass('disabled disabled-by-payu');
                    if (result.status === 'SUCCESS') {
                        secureFormNumber.remove();
                        secureFormDate.remove();
                        secureFormCvv.remove();
                        cardTokenInput.value = result.body.token;
                        document.getElementsByName('payuBrowser[screenWidth]')[0].value = screen.width;
                        document.getElementsByName('payuBrowser[javaEnabled]')[0].value = navigator.javaEnabled();
                        document.getElementsByName('payuBrowser[timezoneOffset]')[0].value = new Date().getTimezoneOffset();
                        document.getElementsByName('payuBrowser[screenHeight]')[0].value = screen.height;
                        document.getElementsByName('payuBrowser[userAgent]')[0].value = navigator.userAgent;
                        document.getElementsByName('payuBrowser[colorDepth]')[0].value = screen.colorDepth;
                        document.getElementsByName('payuBrowser[language]')[0].value = navigator.language;
                        document.getElementById('waiting-box').style.display = '';
                        document.getElementById('card-form-container').style.display = 'none';
                        if (getPayuBinaryBlock('card') !== null) {
                            var cardFields = {};
                            document.querySelectorAll('#payu-card-form input[name=cardToken], #payu-card-form input[name^=payuBrowser]').forEach(function (input) {
                                cardFields[input.name] = input.value;
                            });
                            submitWithOpc(cardFields, function () {
                                showMessageBoxSecureForm(errorTitle);
                            });
                        } else if ($('.repayment-options').length > 0) {
                            $('.repayment-options').submit();
                        } else {
                            document.getElementById('payu-card-form').submit();
                        }

                    } else {
                        var errorMessage = errorTitle;
                        if ($('#payment-confirmation .btn').hasClass('disabled-by-payu')) {
                            $('#payment-confirmation .btn')
                                .removeAttr('disabled', 'disabled')
                                .removeClass('disabled');
                        }
                        result.error.messages.forEach(function (error) {
                            errorMessage += '<strong>' + error.message + '<strong><br>';
                        });

                        showMessageBoxSecureForm(errorMessage);

                        secureFormNumber.update({disabled: false});
                        secureFormDate.update({disabled: false});
                        secureFormCvv.update({disabled: false});
                    }
                });
            } catch (e) {
                showMessageBoxSecureForm(e.message);
            }
        }

        function payuGooglePayValidate() {
            console.log("a");
            hideMessageBoxGooglePay();
            if (!window.google?.payments?.api?.PaymentsClient) {
                showMessageBoxGooglePay(googlePayErrorMessage);
                return false;
            }

            var googleToken = document.getElementById('payu-google-token');
            if (googleToken.value === '') {

                const paymentsClient =
                    new google.payments.api.PaymentsClient({environment: env});

                const isReadyToPayRequest = {
                    apiVersion: 2,
                    apiVersionMinor: 0,
                    allowedPaymentMethods: [
                        {
                            type: 'CARD',
                            parameters: {
                                allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                                allowedCardNetworks: ['MASTERCARD', 'VISA']
                            }
                        }
                    ]
                }

                const paymentDataRequest = {
                    apiVersion: 2,
                    apiVersionMinor: 0,
                    merchantInfo: {
                        merchantName,
                        merchantId,
                    },
                    allowedPaymentMethods: [
                        {
                            type: 'CARD',
                            parameters: {
                                allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                                allowedCardNetworks: ['MASTERCARD', 'VISA'],
                                billingAddressRequired: false
                            },
                            tokenizationSpecification: {
                                type: 'PAYMENT_GATEWAY',
                                parameters: {
                                    gateway: 'payu',
                                    gatewayMerchantId: posId
                                }
                            }
                        }
                    ],
                    transactionInfo: {
                        totalPriceStatus: 'FINAL',
                        countryCode: 'PL',
                        totalPrice,
                        currencyCode: currency
                    }
                }

                paymentsClient.isReadyToPay(isReadyToPayRequest)
                    .then(function (response) {
                        if (response.result) {
                            paymentsClient.loadPaymentData(paymentDataRequest).then(function (paymentData) {
                                paymentToken = paymentData.paymentMethodData.tokenizationData.token;
                                googleToken.value = btoa(paymentToken);
                                if (getPayuBinaryBlock('ap') !== null) {
                                    submitWithOpc({payuGoogleToken: googleToken.value}, function () {
                                        showMessageBoxGooglePay(googlePayErrorMessage);
                                    });
                                } else if ($('.repayment-options').length > 0) {
                                    $('.repayment-options').submit();
                                } else {
                                    document.getElementById('payu-google-pay-form').submit();
                                }
                            }).catch(function (err) {
                                console.error(err);
                            });
                        }
                    })
                    .catch(function (err) {
                        console.error(err);
                        showMessageBoxGooglePay(googlePayErrorMessage);
                    });

                return false;
            } else return true;
        }

        function getCheckedPayuPayMethod(optionSelector) {
            var paymentOption = document.querySelector('[name=payment-option][data-module-name=payu]' + optionSelector + ':checked');
            var paymentName = paymentOption ? document.querySelector('#' + paymentOption.id + '-additional-information .payment-name') : null;

            return paymentName !== null ? paymentName.dataset.pm : null;
        }

        // One-page checkout: Google Pay, Apple Pay and the card form are binary payment options with a PayU button
        function getPayuBinaryBlock(payMethod) {
            return payMethod !== null && getCheckedPayuPayMethod('.binary') === payMethod ? document.querySelector('.payu-payment-binary') : null;
        }

        function updateBinaryButtons() {
            var opcPayButton = document.getElementById('opc-pay-button');
            var binaryButton = document.getElementById('payu-binary-button');

            // same label as the one-page checkout button, including the amount
            if (opcPayButton !== null && binaryButton !== null) {
                binaryButton.textContent = opcPayButton.textContent.trim();
            }
        }

        // a payment error returned by payment.php, shown after the redirect back to the checkout
        function scrollToPaymentNotification() {
            var notification = Array.from(document.querySelectorAll('.payment-name ~ #transfer-response-box')).find(function (box) {
                return box.offsetParent !== null && box.textContent.trim() !== '';
            });

            if (notification !== undefined && !paymentNotificationShown) {
                paymentNotificationShown = true;
                notification.scrollIntoView({behavior: 'smooth', block: 'center'});
            }
        }

        function validateTransferGateway(scrollToError) {
            if (getCheckedPayuPayMethod('') !== 'transfer' || currentGateway === null || currentGateway.value !== ''
                || transferResponseBox === null || !transferResponseBox.dataset.selectGatewayMessage) {
                return true;
            }

            transferResponseBox.textContent = transferResponseBox.dataset.selectGatewayMessage;
            transferResponseBox.style.display = '';
            if (scrollToError) {
                transferResponseBox.scrollIntoView({behavior: 'smooth', block: 'center'});
            }

            return !scrollToError;
        }

        function showOpcValidationErrors(binaryBlock) {
            var opcPayButton = document.getElementById('opc-pay-button');

            if (binaryBlock === null || !binaryBlock.classList.contains('opc-binary-disabled')) {
                return false;
            }

            // let one-page checkout show what is missing in the form
            if (opcPayButton !== null) {
                opcPayButton.click();
            }

            return true;
        }

        function submitWithOpc(fields, onError) {
            var paymentOption = document.querySelector('[name=payment-option]:checked');
            var paymentForm = paymentOption ? document.querySelector('#pay-with-' + paymentOption.id + '-form form') : null;
            var opcPayButton = document.getElementById('opc-pay-button');

            if (paymentForm === null || opcPayButton === null) {
                onError();
                return;
            }

            Object.keys(fields).forEach(function (name) {
                var input = Array.from(paymentForm.elements).find(function (element) {
                    return element.name === name;
                });

                if (input === undefined) {
                    input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = name;
                    paymentForm.appendChild(input);
                }
                input.value = fields[name];
            });

            // one-page checkout saves the checkout and then submits the payment form with the token
            opcPayButton.click();
        }

        function payuApplePayValidate() {
            const APPLE_PAY_API_MIN_VERSION = 1;
            const APPLE_PAY_API_MAX_VERSION = 14;

            hideMessageBoxApplePay();

            if (!window.ApplePaySession || !ApplePaySession.canMakePayments()) {
                showMessageBoxApplePay(applePayErrorMessage);
                return false;
            }

            let applePayToken = document.getElementById('payu-apple-token');
            if (applePayToken.value !== '') {
                return true;
            }

            let applePayApiVersion = APPLE_PAY_API_MIN_VERSION;
            for (let i = APPLE_PAY_API_MAX_VERSION; i >= APPLE_PAY_API_MIN_VERSION; i--) {
                if (ApplePaySession.supportsVersion(i)) {
                    applePayApiVersion = i;
                    break;
                }
            }

            const applePayPaymentRequest = {
                countryCode: 'PL',
                currencyCode: currency,
                total: {
                    type: 'final',
                    label: displayName,
                    amount: totalPrice
                },
                supportedNetworks: ['visa', 'masterCard'],
                merchantCapabilities: [
                    'supports3DS',
                    'supportsCredit',
                    'supportsDebit'
                ]
            };

            const applePaySession = new ApplePaySession(
                applePayApiVersion,
                applePayPaymentRequest
            );

            const abortSession = () => {
                showMessageBoxApplePay(applePayErrorMessage);
                applePaySession.abort();
            }

            applePaySession.onvalidatemerchant = async () => {
                try {
                    let sessionResponse = await fetch(applePaySessionUrl, {
                        headers: {'Content-Type': 'application/json'},
                    });

                    if (sessionResponse.ok) {
                        const session = await sessionResponse.json();
                        applePaySession.completeMerchantValidation(session);
                    } else {
                        abortSession();
                    }
                } catch (error) {
                    console.error("PayU Apple Pay session validation failed:", error);
                    abortSession()
                }
            }

            applePaySession.onpaymentauthorized = (event) => {
                applePaySession.completePayment(ApplePaySession.STATUS_SUCCESS);
                applePayToken.value = btoa(
                    JSON.stringify(event.payment.token.paymentData)
                );
                if (getPayuBinaryBlock('jp') !== null) {
                    submitWithOpc({payuApplePayToken: applePayToken.value}, function () {
                        showMessageBoxApplePay(applePayErrorMessage);
                    });
                } else if ($('.repayment-options').length > 0) {
                    $('.repayment-options').submit();
                } else {
                    document.getElementById('payu-apple-pay-form').submit();
                }
            };

            applePaySession.begin();
            return false;
        }

        function calculateProfile() {
            if (window.innerWidth <= 290) {
                return 'widthLt290';
            } else if (window.innerWidth <= 340) {
                return 'widthLt340';
            }

            return 'widthGt340';
        }

        function secureFormResize() {
            var newProfile = calculateProfile();

            if (newProfile !== secureFormOptions.profile) {
                secureFormOptions.profile = newProfile;
                secureFormNumber.update(secureFormOptions.profiles[secureFormOptions.profile]);
                secureFormDate.update(secureFormOptions.profiles[secureFormOptions.profile]);
                secureFormCvv.update(secureFormOptions.profiles[secureFormOptions.profile]);
            }
        }

        function showMessageBox(elementId, message) {
            var responseBox = document.getElementById(elementId);
            responseBox.innerHTML = message;
            responseBox.style.display = '';
            responseBox.scrollIntoView({behavior: 'smooth', block: 'center'});
        }

        function hideMessageBox(elementId) {
            var responseBox = document.getElementById(elementId);
            responseBox.innerHTML = '';
            responseBox.style.display = 'none';
        }

        function showMessageBoxSecureForm(message) {
            showMessageBox('response-box-secure-form', message);
        }

        function hideMessageBoxSecureForm() {
            hideMessageBox('response-box-secure-form');
        }

        function showMessageBoxGooglePay(message) {
            showMessageBox('response-box-google-pay', message);
        }

        function hideMessageBoxGooglePay() {
            hideMessageBox('response-box-google-pay');
        }

        function showMessageBoxApplePay(message) {
            showMessageBox('response-box-apple-pay', message);
        }

        function hideMessageBoxApplePay() {
            hideMessageBox('response-box-apple-pay');
        }

        function addEventListenersToSubmitButton(){
            document.querySelectorAll('[name=payment-option][data-module-name=payu]').forEach(function (element) {
                console.log(element);
                element.addEventListener('click', function (ev) {
                    console.log("a");
                    var submitButton = document.querySelector('#payment-confirmation .btn, .repayment-options input[type="submit"], #secure-form-pay, #opc-pay-button');

                    submitButton.removeEventListener('click', validateBeforeSubmitGooglePay);
                    submitButton.removeEventListener('click', validateBeforeSubmitCardForm);
                    submitButton.removeEventListener('click', validateBeforeSubmitApplePay);
                    submitButton.removeEventListener('click', validateBeforeSubmitTransfer);

                    var paymentElementId = ev.target.id;
                    var paymentId = paymentElementId.replace('payment-option-', '');
                    var poaiElement = document.getElementById('payment-option-' + paymentId + '-additional-information');
                    var pwpofElement = document.getElementById('pay-with-payment-option-' + paymentId + '-form');
                    var pocElement = document.getElementById('payment-option-' + paymentId + '-container');

                    var paymentNameElement = poaiElement ? poaiElement.querySelector('.payment-name') : null;

                    if (!paymentNameElement) {
                        return;
                    }

                    var payment = paymentNameElement.dataset.pm;

                    if (pocElement?.classList.contains('repayment-single')) {
                        document.getElementById('payuRetryPayment17').querySelectorAll('.additional-information').forEach(function (el) {
                            el.style.display = 'none';
                        })
                        poaiElement.style.display = 'block';
                        document.querySelectorAll('[name=payMethod]').forEach(function (el) {
                            el.value = payment;
                        })
                    }

                    if (payment === 'transfer') {
                        if (currentGateway !== null) {
                            currentGateway.value = '';
                        }

                        Array.from(document.querySelectorAll('.pay-methods__item')).forEach(function (el) {
                            el.classList.remove('payMethodActive');
                        });

                        // in one-page checkout the bank is checked before its own submit handler runs
                        if (!prestashop.is_one_page_checkout_enabled) {
                            submitButton.addEventListener('click', validateBeforeSubmitTransfer);
                        }

                        var paymentIdElement = pwpofElement?.querySelector('input[name=payment_id]');

                    } else if (payment === 'card') {
                        // in one-page checkout the card form has its own button, see binaryButton
                        if (!ev.target.classList.contains('binary')) {
                            document.querySelector('#payment-confirmation .btn, .repayment-options input[type="submit"], #opc-pay-button')
                                .addEventListener('click', validateBeforeSubmitCardForm);
                        }

                        var paymentIdElement = poaiElement?.querySelector('input[name=payment_id]');
                    } else if (payment === 'ap') {
                        console.log("a");
                        let buttons = document.querySelector('#payment-confirmation .btn, .repayment-options input[type="submit"], #opc-pay-button');
                        console.log(buttons);
                        // in one-page checkout Google Pay has its own button, see binaryButton
                        if (!ev.target.classList.contains('binary')) {
                            document.querySelector('#payment-confirmation .btn, .repayment-options input[type="submit"], #opc-pay-button')
                                .addEventListener('click', validateBeforeSubmitGooglePay);
                        }

                        var paymentIdElement = poaiElement?.querySelector('input[name=payment_id]');
                    } else if (payment === "jp") {
                        // in one-page checkout Apple Pay has its own button, see binaryButton
                        if (!ev.target.classList.contains('binary')) {
                            document.querySelector('#payment-confirmation .btn, .repayment-options input[type="submit"], #opc-pay-button')
                                .addEventListener('click', validateBeforeSubmitApplePay);
                        }

                        var paymentIdElement = poaiElement?.querySelector('input[name=payment_id]');
                    }

                    if (paymentIdElement) {
                        paymentIdElement.value = paymentElementId;
                    }

                }, true);
            });

            // an option preselected by the shop (e.g. after a payment error) is never clicked - run the
            // handler above for it, a non-bubbling event does not reach other payment scripts
            var checkedPaymentOption = document.querySelector('[name=payment-option][data-module-name=payu]:checked');
            if (checkedPaymentOption !== null) {
                checkedPaymentOption.dispatchEvent(new Event('click'));
            }
        }
    })
})();
