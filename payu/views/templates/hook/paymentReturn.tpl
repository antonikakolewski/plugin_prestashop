{*
 * PayU
 *
 * @author    PayU
 * @copyright Copyright (c) 2016 PayU
 *
 * http://www.payu.com
*}
<div style="text-align: center">
    <div><img src="{$payuLogo}"></div>
    {if $show_status === '0'}
        <h2>{l s='Thanks for choosing PayU payment.' mod='payu'}</h2>
    {/if}
    {if $show_status === '1'}
        <div id="status-waiting">
            <h2>Please wait...</h2>
            <div id="payu-preloader">
                <output aria-live="polite" aria-busy="true">
                    <img src="modules/payu/img/spinner.svg" alt="..." role="img"/>
                </output>
            </div>
        </div>
        <h2 id="status-result-completed" style="display: none">{l s='Your payment was successful.' mod='payu'}</h2>
        <h2 id="status-result-pending" style="display: none">{l s='Your payment failed.' mod='payu'}</h2>
        <h2 id="status-result-canceled" style="display: none">{l s='Your payment is being processed.' mod='payu'}</h2>
        <h2 id="status-result-error" style="display: none">{l s='Unknown Error' mod='payu'}</h2>
    {/if}
</div>

<script>
    window.payu_get_status_url = '{$url|escape:'none'}';
</script>
