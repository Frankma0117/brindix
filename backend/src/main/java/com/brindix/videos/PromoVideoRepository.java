package com.brindix.videos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromoVideoRepository extends JpaRepository<PromoVideo, Long> {

    List<PromoVideo> findAllByOrderByIdDesc();

    List<PromoVideo> findByStatusIn(List<PromoVideo.Status> statuses);
}
