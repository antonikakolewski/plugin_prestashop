<?php

class PayuStatusModuleFrontController extends ModuleFrontController
{
    public function __construct()
    {
        parent::__construct();
        $this->ajax = true;
    }   


    public function displayAjax()
    {
        $order = new Order(Tools::getValue('id_order'));
        $key = $order->secure_key;
        $status = '';


        if ($key == Tools::getValue('key')){
            $status_id = $order->current_state;
            
            switch ($status_id){
                case Configuration::get('PAYU_PAYMENT_STATUS_COMPLETED'):
                    $status = 'COMPLETED';
                    break;
                case Configuration::get('PAYU_PAYMENT_STATUS_CANCELED'):
                    $status = 'CANCELED';
                    break;
                default:
                    $status = 'PENDING';
                    break;
            }
        }
        else{
            $status = 'PENDING';
        }

        $params = [
            'status' => $status
        ];

        echo json_encode(
           $params
        );
    }
}