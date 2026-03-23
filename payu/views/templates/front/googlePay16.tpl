{*
 * @author    PayU
 * @copyright Copyright (c) PayU
 *
 * http://www.payu.com
*}
<script src="https://pay.google.com/gp/p/js/pay.js"></script>
<script type="text/javascript">
    var env = "{$googlePay.env}";
    var merchantName = "{$googlePay.merchantName}";
    var merchantId = "{$googlePay.merchantId}";
    var posId = "{$googlePay.posId}";
    var totalPrice = "{$googlePay.totalPrice}";
    var currency = "{$googlePay.currency}";
</script>
<span class="payment-name" data-pm="ap"></span>
{if !$retryPayment }
    <form action="{$payuPayAction|escape:'html'}" method="post" id="payu-google-pay-form">
        <input type="hidden" name="payment_id" value="">
        <input type="hidden" name="payuGoogleToken" id="payu-google-token" value="">
        <input type="hidden" name="payMethod" value="ap">
        {include file="$modulePath/views/templates/front/conditions17.tpl"}
        <button class="button btn btn-default button-medium center-block"
			    style="margin: 0 auto;display: table; float:none" type="submit" id="google-pay-submit">
            <span>
                {if !$retryPayment}
                    {l s='I confirm my order' mod='payu'}
                {else}
                    {l s='Pay' mod='payu'}
                {/if}
                <i class="icon-chevron-right right"></i>
            </span>
		</button>
    </form>
{/if}
