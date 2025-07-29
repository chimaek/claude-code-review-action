// TypeScript 예시: 결제 처리기 (보안 및 성능 이슈)
import * as crypto from 'crypto';

interface PaymentRequest {
    amount: number;
    currency: string;
    cardNumber: string;
    cvv: string;
    expiryDate: string;
}

interface PaymentResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}

class PaymentProcessor {
    private apiKey: string = process.env.PAYMENT_API_KEY || "default-key"; // 보안 이슈: 기본값 설정
    private transactions: PaymentRequest[] = []; // 메모리에 민감한 정보 저장

    // 보안 이슈: 신용카드 정보 로깅
    async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
        console.log("Processing payment:", JSON.stringify(request)); // 민감한 정보 로깅
        
        // 입력 검증 부족
        if (!request.amount || request.amount <= 0) {
            throw new Error("Invalid amount");
        }

        // 보안 이슈: 신용카드 번호 검증 없음
        if (request.cardNumber.length < 13) {
            return { success: false, error: "Invalid card number" };
        }

        // 성능 이슈: 동기 처리
        const isValid = this.validateCard(request);
        if (!isValid) {
            return { success: false, error: "Card validation failed" };
        }

        // 보안 이슈: 약한 트랜잭션 ID 생성
        const transactionId = Math.random().toString(36).substr(2, 9);
        
        // 메모리에 민감한 정보 저장
        this.transactions.push(request);

        return {
            success: true,
            transactionId: transactionId
        };
    }

    // 성능 이슈: 비효율적인 검색
    private validateCard(request: PaymentRequest): boolean {
        // 실제 카드 검증 로직 없음
        for (let i = 0; i < 10000; i++) {
            // 불필요한 반복
            if (request.cardNumber.includes("0000")) {
                return false;
            }
        }
        
        // 보안 이슈: CVV 검증 없음
        return true;
    }

    // 보안 이슈: 권한 검증 없이 모든 거래 반환
    public getAllTransactions(): PaymentRequest[] {
        return this.transactions;
    }

    // 메모리 누수: 거래 내역 정리 없음
    public getTransactionHistory(limit?: number): PaymentRequest[] {
        const history = [...this.transactions];
        
        // 성능 이슈: 매번 새 배열 생성
        if (limit) {
            return history.slice(-limit);
        }
        
        return history;
    }

    // 보안 이슈: 평문으로 카드 정보 저장
    private storeCardInfo(cardNumber: string, cvv: string): void {
        const cardInfo = {
            number: cardNumber,    // 평문 저장
            cvv: cvv,             // 평문 저장
            timestamp: Date.now()
        };
        
        // 파일에 평문으로 저장 (매우 위험)
        require('fs').appendFileSync('cards.txt', JSON.stringify(cardInfo) + '\n');
    }
}

// 코드 스타일 이슈: export 방식 일관성 없음
export default PaymentProcessor;
export { PaymentRequest, PaymentResponse };